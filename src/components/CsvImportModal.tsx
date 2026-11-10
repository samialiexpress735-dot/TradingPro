import React, { useState, useMemo, useRef } from 'react';
import { Trade } from '../types/trade';
import {
  parseBrokerCsv,
  getSampleCsv,
  ColumnMapping,
  ParsedCsvResult,
} from '../utils/csvParsers';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Sliders,
  HelpCircle,
  FileText,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTrades: (trades: Trade[]) => void;
  existingTrades: Trade[];
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  onImportTrades,
  existingTrades,
}) => {
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [showMapping, setShowMapping] = useState<boolean>(false);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [filterDuplicates, setFilterDuplicates] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parse result memoized
  const parseResult: ParsedCsvResult | null = useMemo(() => {
    if (!csvContent.trim()) return null;
    return parseBrokerCsv(csvContent, existingTrades, customMapping);
  }, [csvContent, existingTrades, customMapping]);

  // Update selected trades when parseResult changes
  React.useEffect(() => {
    if (parseResult && parseResult.trades.length > 0) {
      const newSelected = new Set<number>();
      parseResult.trades.forEach((t, i) => {
        const isDup = existingTrades.some(
          (ex) =>
            ex.date === t.date &&
            ex.symbol.toUpperCase() === t.symbol.toUpperCase() &&
            Math.abs(ex.entryPrice - t.entryPrice) < 0.05
        );
        if (!filterDuplicates || !isDup) {
          newSelected.add(i);
        }
      });
      setSelectedIndices(newSelected);
    } else {
      setSelectedIndices(new Set());
    }
  }, [parseResult, existingTrades, filterDuplicates]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvContent(text);
      };
      reader.readAsText(file);
    }
  };

  const handleLoadSample = (sampleType: 'generic' | 'tos' | 'ibkr' | 'tradingview') => {
    const sample = getSampleCsv(sampleType);
    setFileName(`sample_${sampleType}_statement.csv`);
    setCsvContent(sample);
  };

  const handleToggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (!parseResult) return;
    const all = new Set<number>();
    parseResult.trades.forEach((_, i) => all.add(i));
    setSelectedIndices(all);
  };

  const handleDeselectAll = () => {
    setSelectedIndices(new Set());
  };

  const handleExecuteImport = () => {
    if (!parseResult) return;
    const tradesToImport = parseResult.trades.filter((_, i) => selectedIndices.has(i));
    if (tradesToImport.length === 0) return;

    onImportTrades(tradesToImport);
    try {
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#78350f', '#92400e', '#1e6b37', '#b45309'],
      });
    } catch {
      // fallback
    }
    onClose();
  };

  const platformLabels: Record<string, string> = {
    generic: 'Standard CSV Format',
    thinkorswim: 'ThinkorSwim (TD / Schwab)',
    ibkr: 'Interactive Brokers (Activity Flex)',
    tradingview: 'TradingView Strategy / Paper',
    metatrader: 'MetaTrader 4 / 5',
    ninjatrader: 'NinjaTrader 8',
    unknown: 'Custom / Unrecognized Format',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-surface-alt">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sunken text-brand border border-line-brand flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink flex items-center gap-2">
                Broker CSV Import Wizard
                <span className="text-[10px] bg-sunken-strong text-brand px-2 py-0.5 rounded-full font-mono font-medium border border-line-brand">
                  Universal Parser
                </span>
              </h2>
              <p className="text-xs text-muted">
                Import statements from ThinkorSwim, Interactive Brokers, TradingView, MetaTrader, or custom spreadsheets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-faint hover:text-ink hover:bg-sunken-strong rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* File drop zone */}
          {!csvContent ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-line-brand hover:border-brand rounded-2xl p-8 text-center bg-canvas hover:bg-sunken transition cursor-pointer flex flex-col items-center justify-center gap-3"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-surface border border-line text-brand flex items-center justify-center shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">
                  Click to upload or drag &amp; drop statement CSV
                </p>
                <p className="text-xs text-faint mt-0.5">
                  Supports .csv, .txt, .tsv from any broker or trading platform
                </p>
              </div>

              {/* Sample loader badges */}
              <div className="pt-3 border-t border-line-soft w-full max-w-md">
                <p className="text-[11px] font-mono text-faint mb-2 uppercase tracking-wider">
                  Or load a sample file to test immediately:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample('generic');
                    }}
                    className="px-3 py-1 bg-surface hover:bg-sunken border border-line-brand rounded-xl text-xs font-semibold text-ink-soft transition"
                  >
                    Generic Sample
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample('tos');
                    }}
                    className="px-3 py-1 bg-surface hover:bg-sunken border border-line-brand rounded-xl text-xs font-semibold text-ink-soft transition"
                  >
                    ThinkorSwim
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample('ibkr');
                    }}
                    className="px-3 py-1 bg-surface hover:bg-sunken border border-line-brand rounded-xl text-xs font-semibold text-ink-soft transition"
                  >
                    Interactive Brokers
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample('tradingview');
                    }}
                    className="px-3 py-1 bg-surface hover:bg-sunken border border-line-brand rounded-xl text-xs font-semibold text-ink-soft transition"
                  >
                    TradingView
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File Info Bar */}
              <div className="bg-surface-alt border border-line rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-line text-ink-soft flex items-center justify-center font-mono">
                    <FileText className="w-5 h-5 text-brand" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-ink block">{fileName || 'Uploaded CSV'}</span>
                    <span className="text-[11px] text-brand font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-profit-solid"></span>
                      {platformLabels[parseResult?.detectedPlatform || 'generic']}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowMapping(!showMapping)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition ${
                      showMapping
                        ? 'bg-brand-solid text-white border-brand'
                        : 'bg-surface text-ink-soft border-line-brand hover:bg-canvas'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{showMapping ? 'Hide Mapper' : 'Adjust Columns'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCsvContent('');
                      setFileName('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-faint hover:text-ink hover:bg-sunken-strong rounded-xl border border-transparent transition flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>

              {/* Column Mapping Options (Accordion) */}
              {showMapping && parseResult && (
                <div className="bg-canvas border border-line rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="text-xs font-bold text-ink">Field Mapping</span>
                    <span className="text-[11px] text-faint">
                      Assign CSV columns to TradePulse metrics
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label className="text-[11px] text-muted font-medium block mb-1">Symbol / Ticker</label>
                      <select
                        value={customMapping.symbolCol || ''}
                        onChange={(e) => setCustomMapping((prev) => ({ ...prev, symbolCol: e.target.value }))}
                        className="w-full bg-surface border border-line-brand rounded-xl px-2.5 py-1.5 text-xs text-ink"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted font-medium block mb-1">Date</label>
                      <select
                        value={customMapping.dateCol || ''}
                        onChange={(e) => setCustomMapping((prev) => ({ ...prev, dateCol: e.target.value }))}
                        className="w-full bg-surface border border-line-brand rounded-xl px-2.5 py-1.5 text-xs text-ink"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted font-medium block mb-1">Net P&amp;L</label>
                      <select
                        value={customMapping.netPnlCol || ''}
                        onChange={(e) => setCustomMapping((prev) => ({ ...prev, netPnlCol: e.target.value }))}
                        className="w-full bg-surface border border-line-brand rounded-xl px-2.5 py-1.5 text-xs text-ink"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-muted font-medium block mb-1">Quantity</label>
                      <select
                        value={customMapping.quantityCol || ''}
                        onChange={(e) => setCustomMapping((prev) => ({ ...prev, quantityCol: e.target.value }))}
                        className="w-full bg-surface border border-line-brand rounded-xl px-2.5 py-1.5 text-xs text-ink"
                      >
                        <option value="">Auto-detected</option>
                        {parseResult.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Duplicate Filter & Selection Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface border border-line rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-ink">
                    Found {parseResult?.trades.length || 0} trades
                  </span>
                  {parseResult && parseResult.duplicatesCount > 0 && (
                    <span className="bg-warn-bg-soft text-accent border border-warn-line px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {parseResult.duplicatesCount} duplicate{parseResult.duplicatesCount > 1 ? 's' : ''} detected
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-ink-soft cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterDuplicates}
                      onChange={(e) => setFilterDuplicates(e.target.checked)}
                      className="rounded accent-brand-solid"
                    />
                    <span>Skip duplicates</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-brand hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-[#d5c3b1]">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    className="text-faint hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-line rounded-2xl overflow-hidden bg-surface max-h-[340px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-canvas text-muted border-b border-line font-mono text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 w-8"></th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Side</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Entry</th>
                      <th className="py-2.5 px-3 text-right">Exit</th>
                      <th className="py-2.5 px-3 text-right">Net P&amp;L</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {parseResult?.trades.map((t, idx) => {
                      const isSelected = selectedIndices.has(idx);
                      const isDup = existingTrades.some(
                        (ex) =>
                          ex.date === t.date &&
                          ex.symbol.toUpperCase() === t.symbol.toUpperCase() &&
                          Math.abs(ex.entryPrice - t.entryPrice) < 0.05
                      );

                      return (
                        <tr
                          key={t.id}
                          onClick={() => handleToggleSelect(idx)}
                          className={`hover:bg-canvas cursor-pointer transition ${
                            isSelected ? 'bg-surface-alt' : 'opacity-60'
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(idx)}
                              className="rounded accent-brand-solid"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </td>
                          <td className="py-2 px-3 font-mono text-ink-soft whitespace-nowrap">{t.date}</td>
                          <td className="py-2 px-3 font-bold text-ink">{t.symbol}</td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                t.direction === 'long'
                                  ? 'bg-profit-bg text-profit'
                                  : 'bg-loss-bg text-loss'
                              }`}
                            >
                              {t.direction}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{t.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">${t.entryPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono">${t.exitPrice.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                            <span className={t.netPnl >= 0 ? 'text-profit' : 'text-loss'}>
                              {t.netPnl >= 0 ? '+' : '-'}${Math.abs(t.netPnl).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {isDup ? (
                              <span className="text-[10px] text-accent font-mono bg-warn-bg-soft px-1.5 py-0.5 rounded border border-warn-line">
                                Existing
                              </span>
                            ) : (
                              <span className="text-[10px] text-profit font-mono bg-profit-bg px-1.5 py-0.5 rounded border border-profit-line">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-line bg-surface-alt">
          <div className="text-xs text-muted">
            {selectedIndices.size} trade{selectedIndices.size === 1 ? '' : 's'} selected for import
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink hover:bg-sunken-strong rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedIndices.size === 0}
              onClick={handleExecuteImport}
              className="px-5 py-2.5 bg-brand-solid hover:bg-brand-solid-hover disabled:bg-line-brand disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Import {selectedIndices.size} Trade{selectedIndices.size === 1 ? '' : 's'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
