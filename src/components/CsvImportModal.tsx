import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trade } from '../types/trade';
import { parseBrokerCsv, getSampleCsv, ColumnMapping, ParsedCsvResult, SampleBroker } from '../utils/csvParsers';
import { readCsvFile } from '../utils/csvCore';
import { buildDuplicateChecker } from '../utils/tradeDedupe';
import { formatPrice, formatPnL } from '../utils/formatters';
import type { BinanceTimezone } from '../utils/binanceCsv';
import {
  X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Sliders, FileText, RotateCcw, Info,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTrades: (trades: Trade[]) => void;
  existingTrades: Trade[];
}

const PLATFORM_LABELS: Record<string, string> = {
  generic: 'Standard CSV Format',
  thinkorswim: 'ThinkorSwim (TD / Schwab)',
  ibkr: 'Interactive Brokers (Activity Flex)',
  tradingview: 'TradingView Strategy / Paper',
  metatrader: 'MetaTrader 4 / 5',
  ninjatrader: 'NinjaTrader 8',
  binance: 'Binance',
  unknown: 'Custom / Unrecognized Format',
};

const SAMPLES: { id: SampleBroker; label: string }[] = [
  { id: 'binance_spot', label: 'Binance Spot' },
  { id: 'binance_futures', label: 'Binance Futures' },
  { id: 'generic', label: 'Standard CSV' },
  { id: 'tos', label: 'ThinkorSwim' },
  { id: 'ibkr', label: 'IBKR' },
  { id: 'tradingview', label: 'TradingView' },
];

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'dateCol', label: 'Date / Time', required: true },
  { key: 'symbolCol', label: 'Symbol', required: true },
  { key: 'entryPriceCol', label: 'Entry Price', required: true },
  { key: 'quantityCol', label: 'Quantity', required: true },
  { key: 'directionCol', label: 'Direction / Side' },
  { key: 'exitPriceCol', label: 'Exit Price' },
  { key: 'netPnlCol', label: 'Net P&L' },
  { key: 'feesCol', label: 'Fees / Commission' },
];

const localTzName = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'your timezone'; }
};

export const CsvImportModal: React.FC<CsvImportModalProps> = ({ isOpen, onClose, onImportTrades, existingTrades }) => {
  const [csvContent, setCsvContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [loadError, setLoadError] = useState('');
  const [binanceTz, setBinanceTz] = useState<BinanceTimezone>('local');
  const [showMapping, setShowMapping] = useState(false);
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setCsvContent(''); setFileName(''); setLoadError(''); setShowMapping(false);
    setCustomMapping({}); setSelected(new Set()); setSkipDuplicates(true); setDragging(false);
  };

  // Don't keep a previously loaded file around when the dialog is reopened
  useEffect(() => { if (!isOpen) reset(); }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const parseResult: ParsedCsvResult | null = useMemo(() => {
    if (!csvContent.trim()) return null;
    return parseBrokerCsv(csvContent, existingTrades, customMapping, { binanceTimezone: binanceTz });
  }, [csvContent, existingTrades, customMapping, binanceTz]);

  const dupFlags = useMemo(() => {
    if (!parseResult) return [] as boolean[];
    const isDup = buildDuplicateChecker(existingTrades);
    return parseResult.trades.map((t) => isDup(t));
  }, [parseResult, existingTrades]);

  // Default selection: everything new and closed. Duplicates and still-open positions start unticked.
  useEffect(() => {
    const next = new Set<number>();
    parseResult?.trades.forEach((t, i) => {
      if (t.status === 'open') return;
      if (skipDuplicates && dupFlags[i]) return;
      next.add(i);
    });
    setSelected(next);
  }, [parseResult, dupFlags, skipDuplicates]);

  if (!isOpen) return null;

  const loadText = (text: string, name: string) => {
    setLoadError('');
    setCustomMapping({});
    setShowMapping(false);
    setFileName(name);
    setCsvContent(text);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      loadText(await readCsvFile(file), file.name);
    } catch (err) {
      setCsvContent('');
      setLoadError(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const handleLoadSample = (id: SampleBroker) => loadText(getSampleCsv(id), `sample_${id}.csv`);

  const toggle = (i: number) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  const importable = parseResult?.trades ?? [];
  const chosen = importable.filter((_, i) => selected.has(i));
  const chosenNet = chosen.reduce((a, t) => a + (t.status === 'closed' ? t.netPnl : 0), 0);
  const isBinance = parseResult?.detectedPlatform === 'binance';

  const handleExecuteImport = () => {
    if (chosen.length === 0) return;
    onImportTrades(chosen);
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 }, colors: ['#4f46e5', '#6366f1', '#16a34a', '#0891b2'] });
    } catch { /* decorative */ }
    onClose();
  };

  const fmtQty = (q: number) => Number(q.toPrecision(6)).toLocaleString('en-US', { maximumFractionDigits: 8 });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="csv-import-title">
      <div className="bg-surface border border-line rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-line bg-surface-alt">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-sunken text-brand border border-line-brand flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 id="csv-import-title" className="text-base font-bold text-ink flex items-center gap-2 flex-wrap">
                CSV Import Wizard
                <span className="text-[10px] bg-sunken-strong text-brand px-2 py-0.5 rounded-full font-mono font-medium border border-line-brand">Universal Parser</span>
              </h2>
              <p className="text-xs text-muted">Binance, ThinkorSwim, Interactive Brokers, TradingView, MetaTrader, or any spreadsheet.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 text-faint hover:text-ink hover:bg-sunken-strong rounded-xl transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {!csvContent ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition cursor-pointer flex flex-col items-center justify-center gap-3 ${dragging ? 'border-brand bg-sunken' : 'border-line-brand hover:border-brand bg-canvas hover:bg-sunken'}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv,text/csv"
                  onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ''; }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-surface border border-line text-brand flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Click to upload or drag &amp; drop your CSV</p>
                  <p className="text-xs text-faint mt-0.5">.csv, .txt or .tsv. Binance: Orders → Trade History → Export</p>
                </div>
              </div>

              {loadError && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-loss-line bg-loss-bg text-loss text-xs" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{loadError}</span>
                </div>
              )}

              <div className="rounded-2xl border border-line-soft bg-surface-alt p-4">
                <p className="text-[11px] font-mono text-faint mb-2 uppercase tracking-wider">No file handy? Try a sample</p>
                <div className="flex flex-wrap gap-2">
                  {SAMPLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleLoadSample(s.id)}
                      className="px-3 py-1.5 text-xs font-semibold bg-surface hover:bg-sunken-strong border border-line-strong rounded-lg text-ink-soft transition cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* File bar */}
              <div className="flex items-center justify-between gap-3 bg-surface-alt border border-line rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-brand shrink-0" />
                  <span className="text-xs font-semibold text-ink truncate">{fileName}</span>
                  {parseResult && (
                    <span className="hidden sm:inline text-[11px] text-faint font-mono shrink-0">
                      {parseResult.formatLabel || PLATFORM_LABELS[parseResult.detectedPlatform]}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isBinance && (
                    <button type="button" onClick={() => setShowMapping((v) => !v)} className="px-2.5 py-1 text-[11px] font-bold text-brand bg-sunken hover:bg-sunken-strong border border-line-brand rounded-lg flex items-center gap-1 transition cursor-pointer">
                      <Sliders className="w-3 h-3" /> Adjust Columns
                    </button>
                  )}
                  <button type="button" onClick={reset} className="px-2.5 py-1 text-[11px] font-bold text-muted hover:text-ink bg-surface border border-line-strong rounded-lg flex items-center gap-1 transition cursor-pointer">
                    <RotateCcw className="w-3 h-3" /> Change File
                  </button>
                </div>
              </div>

              {/* Mapping */}
              {showMapping && parseResult && (
                <div className="border border-line-brand bg-canvas rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-ink">Map your columns</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MAPPING_FIELDS.map((f) => (
                      <label key={f.key} className="text-[11px] font-semibold text-muted space-y-1 block">
                        <span>{f.label}{f.required ? ' *' : ''}</span>
                        <select
                          value={customMapping[f.key] || ''}
                          onChange={(e) => setCustomMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))}
                          className="w-full bg-surface border border-line-strong rounded-lg px-2 py-1.5 text-xs text-ink"
                        >
                          <option value="">Auto-detect</option>
                          {parseResult.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Binance info + timezone */}
              {isBinance && parseResult?.binance && !parseResult.error && (
                <div className="border border-line-brand bg-sunken rounded-2xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-brand shrink-0 mt-0.5" />
                    <div className="text-xs text-ink-soft">
                      <p className="font-bold text-ink">{parseResult.binance.formatLabel}</p>
                      <p className="mt-0.5">
                        Read <b>{parseResult.binance.fillCount}</b> executions and paired them into <b>{parseResult.binance.trades.length}</b> trade{parseResult.binance.trades.length === 1 ? '' : 's'}.
                        Buys and sells of the same coin are matched into one round trip with real P&amp;L.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted font-semibold">Binance times are UTC. Show them as:</span>
                    <div className="inline-flex rounded-lg border border-line-strong overflow-hidden" role="group" aria-label="Timezone">
                      {([['local', `My time (${localTzName()})`], ['utc', 'UTC']] as [BinanceTimezone, string][]).map(([v, label]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setBinanceTz(v)}
                          aria-pressed={binanceTz === v}
                          className={`px-3 py-1.5 font-semibold transition cursor-pointer ${binanceTz === v ? 'bg-brand-solid text-white' : 'bg-surface text-ink-soft hover:bg-sunken-strong'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {parseResult && parseResult.warnings.length > 0 && (
                <div className="rounded-2xl border border-warn-line bg-warn-bg-soft p-3 space-y-1.5" role="status">
                  {parseResult.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-brand">
                      <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {parseResult?.error && (
                <div className="rounded-2xl border border-loss-line bg-loss-bg p-4 space-y-3" role="alert">
                  <div className="flex items-start gap-2 text-sm text-loss">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{parseResult.error}</span>
                  </div>
                  <button type="button" onClick={reset} className="px-3 py-1.5 text-xs font-bold text-ink-soft bg-surface border border-line-strong rounded-lg hover:bg-sunken-strong transition cursor-pointer">
                    Choose another file
                  </button>
                </div>
              )}

              {/* Preview */}
              {parseResult && !parseResult.error && importable.length > 0 && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-ink flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-profit" />
                      {importable.length} trade{importable.length === 1 ? '' : 's'} found
                      {parseResult.duplicatesCount > 0 && <span className="font-normal text-faint">· {parseResult.duplicatesCount} already in your journal</span>}
                    </p>
                    <div className="flex items-center gap-3 text-[11px]">
                      <label className="flex items-center gap-1.5 text-muted cursor-pointer select-none">
                        <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} className="accent-brand-solid" />
                        Skip duplicates
                      </label>
                      <button type="button" onClick={() => setSelected(new Set(importable.map((_, i) => i)))} className="font-bold text-brand hover:underline cursor-pointer">Select all</button>
                      <button type="button" onClick={() => setSelected(new Set())} className="font-bold text-muted hover:underline cursor-pointer">None</button>
                    </div>
                  </div>

                  <div className="border border-line rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[38vh] overflow-y-auto">
                      <table className="w-full text-xs min-w-[640px]">
                        <thead className="bg-surface-alt text-faint sticky top-0">
                          <tr className="text-left font-mono uppercase text-[10px] tracking-wider">
                            <th className="px-3 py-2 w-8"></th>
                            <th className="px-2 py-2">Date</th>
                            <th className="px-2 py-2">Symbol</th>
                            <th className="px-2 py-2">Dir</th>
                            <th className="px-2 py-2 text-right">Qty</th>
                            <th className="px-2 py-2 text-right">Entry</th>
                            <th className="px-2 py-2 text-right">Exit</th>
                            <th className="px-2 py-2 text-right">Net P&amp;L</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line-soft">
                          {importable.map((t, i) => {
                            const dup = dupFlags[i];
                            const open = t.status === 'open';
                            return (
                              <tr key={t.id} className={`${selected.has(i) ? '' : 'opacity-55'} hover:bg-surface-alt cursor-pointer`} onClick={() => toggle(i)}>
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} onClick={(e) => e.stopPropagation()} aria-label={`Import ${t.symbol} ${t.date}`} className="accent-brand-solid" />
                                </td>
                                <td className="px-2 py-2 font-mono text-muted whitespace-nowrap">{t.date} <span className="text-faint">{t.time}</span></td>
                                <td className="px-2 py-2 font-bold text-ink whitespace-nowrap">{t.symbol}</td>
                                <td className={`px-2 py-2 font-semibold uppercase ${t.direction === 'long' ? 'text-profit' : 'text-loss'}`}>{t.direction}</td>
                                <td className="px-2 py-2 text-right font-mono text-ink-soft">{fmtQty(t.quantity)}</td>
                                <td className="px-2 py-2 text-right font-mono text-ink-soft">{formatPrice(t.entryPrice)}</td>
                                <td className="px-2 py-2 text-right font-mono text-ink-soft">{open ? '—' : formatPrice(t.exitPrice)}</td>
                                <td className={`px-2 py-2 text-right font-mono font-bold ${open ? 'text-faint' : t.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{open ? '—' : formatPnL(t.netPnl)}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  {open ? <span className="px-1.5 py-0.5 rounded bg-warn-bg text-brand text-[10px] font-bold">OPEN</span>
                                    : dup ? <span className="px-1.5 py-0.5 rounded bg-sunken-strong text-muted text-[10px] font-bold">EXISTS</span>
                                    : <span className="px-1.5 py-0.5 rounded bg-profit-bg text-profit text-[10px] font-bold">NEW</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-line bg-surface-alt">
          <p className="text-xs text-muted font-mono">
            {parseResult && !parseResult.error ? (
              <>
                <b className="text-ink">{chosen.length}</b> selected · net{' '}
                <b className={chosenNet >= 0 ? 'text-profit' : 'text-loss'}>{formatPnL(chosenNet)}</b>
              </>
            ) : 'Choose a file to begin'}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-muted hover:text-ink bg-surface border border-line-strong rounded-xl transition cursor-pointer">Cancel</button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={chosen.length === 0}
              className="px-4 py-2 text-xs font-bold text-white bg-brand-solid hover:bg-brand-solid-hover disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              Import {chosen.length > 0 ? chosen.length : ''} trade{chosen.length === 1 ? '' : 's'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
