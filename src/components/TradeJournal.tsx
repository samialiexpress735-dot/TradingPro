import React, { useState, useMemo } from 'react';
import { Trade, Strategy, AssetClass, TradeOutcome } from '../types/trade';
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
} from 'lucide-react';
import { CsvImportModal } from './CsvImportModal';
import { SocialTradeCardModal } from './SocialTradeCardModal';

interface TradeJournalProps {
  trades: Trade[];
  strategies: Strategy[];
  onAddTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  onDeleteTrade: (id: string) => void;
  onDuplicateTrade: (trade: Trade) => void;
  onImportCsv: (trades: Trade[]) => void;
}

export const TradeJournal: React.FC<TradeJournalProps> = ({
  trades,
  strategies,
  onAddTrade,
  onEditTrade,
  onDeleteTrade,
  onDuplicateTrade,
  onImportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string>('all');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('all');
  const [sortField, setSortField] = useState<'date' | 'netPnl' | 'roi' | 'realizedRR'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [cardModalTrade, setCardModalTrade] = useState<Trade | null>(null);

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

        return matchesSearch && matchesAsset && matchesOutcome && matchesStrategy && matchesEmotion;
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
  }, [trades, searchTerm, selectedAsset, selectedOutcome, selectedStrategy, selectedEmotion, sortField, sortOrder]);

  // Quick statistics for current filtered view
  const filteredStats = useMemo(() => {
    const closed = filteredTrades.filter((t) => t.status === 'closed');
    const wins = closed.filter((t) => t.outcome === 'win').length;
    const net = closed.reduce((acc, t) => acc + t.netPnl, 0);
    const winRate = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    return {
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
      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] w-full sm:w-auto">
            <Search className="w-4 h-4 text-[#8c7462] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search ticker, strategy, notes..."
              className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl pl-9 pr-4 py-2 text-xs text-[#281d16] placeholder-[#9e8b7c] focus:outline-none focus:border-[#78350f] transition"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#78350f] text-xs font-semibold rounded-xl border border-[#debfa8] flex items-center gap-1.5 transition cursor-pointer"
              title="Import trades from broker CSV or statements"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Statement</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] text-xs font-medium rounded-xl border border-[#e2d8cb] flex items-center gap-1.5 transition cursor-pointer"
              title="Export all trades to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export </span><span>CSV</span>
            </button>

            <button
              onClick={onAddTrade}
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Trade</span>
            </button>
          </div>
        </div>

        {/* Filter Dropdowns row */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-2 border-t border-[#ede6dc] text-xs">
          <span className="text-[#8c7462] font-mono text-[10px] sm:text-[11px] flex items-center gap-1 mr-0.5">
            <Filter className="w-3 h-3" /> Filters:
          </span>

          {/* Asset filter */}
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-[#4a3b32] focus:outline-none focus:border-[#78350f] capitalize"
          >
            <option value="all">All Assets</option>
            <option value="stocks">Stocks</option>
            <option value="crypto">Crypto</option>
            <option value="forex">Forex</option>
            <option value="futures">Futures</option>
            <option value="options">Options</option>
          </select>

          {/* Outcome filter */}
          <select
            value={selectedOutcome}
            onChange={(e) => setSelectedOutcome(e.target.value)}
            className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-[#4a3b32] focus:outline-none focus:border-[#78350f] capitalize"
          >
            <option value="all">All Outcomes</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="breakeven">BE</option>
            <option value="open">Open</option>
          </select>

          {/* Strategy filter */}
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-[#4a3b32] focus:outline-none focus:border-[#78350f]"
          >
            <option value="all">All Setups</option>
            {strategies.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Emotion filter */}
          <select
            value={selectedEmotion}
            onChange={(e) => setSelectedEmotion(e.target.value)}
            className="bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 text-xs text-[#4a3b32] focus:outline-none focus:border-[#78350f]"
          >
            <option value="all">All Mindsets</option>
            <option value="Disciplined">Disciplined</option>
            <option value="Patient">Patient</option>
            <option value="FOMO">FOMO</option>
            <option value="Revenge">Revenge</option>
            <option value="Hesitant">Hesitant</option>
            <option value="Greedy">Greedy</option>
          </select>

          {/* Summary badge for current filter */}
          <div className="w-full sm:w-auto sm:ml-auto flex items-center justify-between sm:justify-end gap-3 font-mono text-[10px] sm:text-[11px] text-[#7d695b] mt-1 sm:mt-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-[#ede6dc]">
            <span>
              <strong className="text-[#281d16]">{filteredTrades.length}</strong> trades
            </span>
            <span>
              Net:{' '}
              <strong className={filteredStats.net >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'}>
                {filteredStats.net >= 0 ? '+' : ''}${filteredStats.net.toLocaleString()}
              </strong>
            </span>
            <span>
              WR: <strong className="text-[#78350f]">{filteredStats.winRate}%</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl shadow-xs overflow-hidden">
        <div className="sm:hidden px-3 py-1.5 bg-[#faf7f2] border-b border-[#ede6dc] text-[10px] text-[#8c7462] font-mono flex items-center justify-between">
          <span>← Swipe horizontally for full metrics →</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8f5f0] text-[#7d695b] border-b border-[#e8dfd5] font-mono uppercase text-[11px] tracking-wider select-none">
                <th
                  onClick={() => handleToggleSort('date')}
                  className="py-3.5 px-4 cursor-pointer hover:text-[#281d16] transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Date &amp; Time</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8c7462]" />
                  </div>
                </th>
                <th className="py-3.5 px-3">Symbol / Dir</th>
                <th className="py-3.5 px-3">Asset</th>
                <th className="py-3.5 px-3">Setup / Strategy</th>
                <th className="py-3.5 px-3">Entry &amp; Exit</th>
                <th
                  onClick={() => handleToggleSort('netPnl')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#281d16] transition"
                >
                  <div className="flex items-center gap-1">
                    <span>Net P&amp;L</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8c7462]" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('roi')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#281d16] transition"
                >
                  <div className="flex items-center gap-1">
                    <span>ROI %</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8c7462]" />
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort('realizedRR')}
                  className="py-3.5 px-3 cursor-pointer hover:text-[#281d16] transition hidden md:table-cell"
                >
                  <div className="flex items-center gap-1">
                    <span>R:R</span>
                    <ArrowUpDown className="w-3 h-3 text-[#8c7462]" />
                  </div>
                </th>
                <th className="py-3.5 px-3 hidden lg:table-cell">Psychology</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#ede6dc] font-sans">
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-[#8c7462]">
                    {trades.length === 0 ? (
                      <div className="max-w-md mx-auto space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-[#f4ebe1] flex items-center justify-center mx-auto text-[#78350f]">
                          <BookOpen className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-[#281d16]">No trades logged yet</h3>
                        <p className="text-xs text-[#7d695b]">
                          Start building your trading track record by logging individual executions or importing historical broker trade statements.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2.5">
                          <button
                            onClick={onAddTrade}
                            className="px-4 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Log Trade</span>
                          </button>
                          <button
                            onClick={() => setIsCsvModalOpen(true)}
                            className="px-4 py-2 bg-white hover:bg-[#f6efe6] text-[#78350f] text-xs font-bold rounded-xl border border-[#d2bfad] transition cursor-pointer flex items-center gap-1.5"
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
                          onClick={() => {
                            setSearchTerm('');
                            setSelectedAsset('all');
                            setSelectedOutcome('all');
                            setSelectedStrategy('all');
                            setSelectedEmotion('all');
                          }}
                          className="mt-2 text-xs text-[#78350f] hover:underline cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
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
                        className={`hover:bg-[#faf7f2] transition group cursor-pointer ${
                          isExpanded ? 'bg-[#f5ede4]/40' : ''
                        }`}
                        onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                      >
                        {/* Date & Time */}
                        <td className="py-3 px-4 font-mono">
                          <div className="text-[#281d16] font-semibold">{trade.date}</div>
                          <div className="text-[#8c7462] text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{trade.time}</span>
                          </div>
                        </td>

                        {/* Symbol & Direction */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#281d16] font-mono text-sm tracking-tight">
                              {trade.symbol}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                trade.direction === 'long'
                                  ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                                  : 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                              }`}
                            >
                              {trade.direction}
                            </span>
                          </div>
                        </td>

                        {/* Asset Class */}
                        <td className="py-3 px-3">
                          <span className="capitalize text-[#78350f] bg-[#f5ede4] px-2 py-0.5 rounded-md border border-[#debfa8] text-[11px]">
                            {trade.assetClass}
                          </span>
                        </td>

                        {/* Strategy */}
                        <td className="py-3 px-3">
                          <span className="text-[#4a3b32] font-medium truncate max-w-[150px] inline-block">
                            {trade.strategy}
                          </span>
                        </td>

                        {/* Entry & Exit */}
                        <td className="py-3 px-3 font-mono text-xs">
                          <div className="text-[#281d16]">${trade.entryPrice.toLocaleString()}</div>
                          <div className="text-[#8c7462] text-[11px]">
                            {isOpen ? '→ Live' : `→ $${trade.exitPrice.toLocaleString()}`}
                          </div>
                        </td>

                        {/* Net P&L */}
                        <td className="py-3 px-3 font-mono font-bold text-sm">
                          {isOpen ? (
                            <span className="text-[#78350f] bg-[#f5ede4] px-2 py-0.5 rounded border border-[#debfa8] text-xs">
                              OPEN
                            </span>
                          ) : (
                            <span className={isWin ? 'text-[#1e6b37]' : isLoss ? 'text-[#b93829]' : 'text-[#7d695b]'}>
                              {trade.netPnl >= 0 ? '+' : ''}${trade.netPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        {/* ROI % */}
                        <td className="py-3 px-3 font-mono text-xs">
                          {isOpen ? (
                            <span className="text-[#8c7462]">—</span>
                          ) : (
                            <span className={trade.roi >= 0 ? 'text-[#1e6b37] font-semibold' : 'text-[#b93829] font-semibold'}>
                              {trade.roi >= 0 ? '+' : ''}{trade.roi}%
                            </span>
                          )}
                        </td>

                        {/* R:R */}
                        <td className="py-3 px-3 font-mono text-xs hidden md:table-cell">
                          {isOpen ? (
                            <span className="text-[#78350f] text-[11px]">P: 1:{trade.plannedRR}</span>
                          ) : (
                            <div className="flex flex-col">
                              <span className={trade.realizedRR >= 0 ? 'text-[#1e6b37] font-bold' : 'text-[#b93829] font-bold'}>
                                {trade.realizedRR}R
                              </span>
                              <span className="text-[10px] text-[#8c7462]">Plan: 1:{trade.plannedRR}</span>
                            </div>
                          )}
                        </td>

                        {/* Psychology Emotion */}
                        <td className="py-3 px-3 hidden lg:table-cell">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border inline-flex items-center gap-1 ${
                              trade.emotion === 'Disciplined' || trade.emotion === 'Patient'
                                ? 'bg-[#edf7ed] text-[#1e6b37] border-[#c3e6cb]'
                                : trade.emotion === 'FOMO' || trade.emotion === 'Revenge'
                                ? 'bg-[#fef2f2] text-[#b93829] border-[#fecaca]'
                                : 'bg-[#f5ede4] text-[#78350f] border-[#debfa8]'
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
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setCardModalTrade(trade)}
                              className="p-1.5 text-[#7d695b] hover:text-[#78350f] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                              title="Export / Share Trade Card"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {trade.chartUrl && (
                              <button
                                onClick={() => setPreviewImageUrl(trade.chartUrl!)}
                                className="p-1.5 text-[#7d695b] hover:text-[#281d16] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                                title="View chart screenshot"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => onDuplicateTrade(trade)}
                              className="p-1.5 text-[#7d695b] hover:text-[#78350f] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                              title="Duplicate trade setup"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onEditTrade(trade)}
                              className="p-1.5 text-[#7d695b] hover:text-[#1e6b37] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                              title="Edit trade"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                if (window.confirm(`Delete trade ${trade.symbol} on ${trade.date}?`)) {
                                  onDeleteTrade(trade.id);
                                }
                              }}
                              className="p-1.5 text-[#7d695b] hover:text-[#b93829] hover:bg-[#ede6dc] rounded-lg transition cursor-pointer"
                              title="Delete trade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Trade Deep Dive */}
                      {isExpanded && (
                        <tr className="bg-[#faf7f2] border-b border-[#ede6dc]">
                          <td colSpan={10} className="p-4 sm:p-5">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              {/* Left detail column */}
                              <div className="md:col-span-8 space-y-3">
                                <div>
                                  <h4 className="text-xs font-bold text-[#634832] uppercase tracking-wider mb-1">
                                    Trade Thesis &amp; Post-Trade Review
                                  </h4>
                                  <p className="text-[#281d16] text-xs leading-relaxed bg-white p-3 rounded-xl border border-[#e8dfd5]">
                                    {trade.notes || 'No specific notes recorded for this execution.'}
                                  </p>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                                  <div className="p-2.5 bg-white rounded-xl border border-[#e8dfd5]">
                                    <span className="text-[10px] text-[#8c7462] uppercase block font-sans">Stop Loss</span>
                                    <span className="text-[#b93829] font-bold">${trade.stopLoss}</span>
                                  </div>
                                  <div className="p-2.5 bg-white rounded-xl border border-[#e8dfd5]">
                                    <span className="text-[10px] text-[#8c7462] uppercase block font-sans">Take Profit</span>
                                    <span className="text-[#1e6b37] font-bold">${trade.takeProfit}</span>
                                  </div>
                                  <div className="p-2.5 bg-white rounded-xl border border-[#e8dfd5]">
                                    <span className="text-[10px] text-[#8c7462] uppercase block font-sans">Position Qty</span>
                                    <span className="text-[#281d16] font-semibold">{trade.quantity.toLocaleString()}</span>
                                  </div>
                                  <div className="p-2.5 bg-white rounded-xl border border-[#e8dfd5]">
                                    <span className="text-[10px] text-[#8c7462] uppercase block font-sans">Fees / Comm</span>
                                    <span className="text-[#7d695b]">${trade.fees}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-[#7d695b]">
                                    Rule Adherence:{' '}
                                    <strong
                                      className={
                                        trade.mistake === 'Followed Plan' ? 'text-[#1e6b37]' : 'text-[#b45309]'
                                      }
                                    >
                                      {trade.mistake || 'Followed Plan'}
                                    </strong>
                                  </span>
                                  <span className="text-[#7d695b]">
                                    Session: <strong className="text-[#281d16]">{trade.marketSession || 'NY Open'}</strong>
                                  </span>
                                  <span className="text-[#7d695b]">
                                    Rating: <strong className="text-[#78350f]">★ {trade.rating} / 5</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Right column: Chart thumbnail */}
                              <div className="md:col-span-4 flex flex-col justify-center">
                                {trade.chartUrl ? (
                                  <div
                                    className="cursor-pointer group relative rounded-xl overflow-hidden border border-[#debfa8] bg-white aspect-video shadow-xs"
                                    onClick={() => setPreviewImageUrl(trade.chartUrl!)}
                                  >
                                    <img
                                      src={trade.chartUrl}
                                      alt="Trade chart"
                                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                    />
                                    <div className="absolute inset-0 bg-[#281d16]/30 group-hover:bg-[#281d16]/10 transition flex items-center justify-center">
                                      <span className="text-[11px] text-white font-medium bg-[#281d16]/70 px-2 py-1 rounded-md backdrop-blur-xs">
                                        Click to Expand Chart
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-[#dacfc3] p-6 text-center text-[#8c7462] text-xs">
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

      {/* Chart Image Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#281d16]/80 backdrop-blur-xs"
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
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl border border-[#debfa8] shadow-2xl"
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
    </div>
  );
};
