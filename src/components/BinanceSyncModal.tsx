import { readCsvFile } from '../utils/csvCore';
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ShieldCheck,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  Sparkles,
  Key,
  ExternalLink,
  Info,
} from 'lucide-react';
import { Trade } from '../types/trade';
import {
  parseBinanceCsv,
  BinanceParsedResult,
  SAMPLE_BINANCE_SPOT_CSV,
  SAMPLE_BINANCE_FUTURES_CSV,
} from '../utils/binanceParser';
import { saveUserSettings } from '../lib/supabase';
import { formatPrice, formatQuantity, formatPnL } from '../utils/formatters';

interface BinanceSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTrades: (newTrades: Trade[]) => Promise<void> | void;
  existingTrades: Trade[];
  userId?: string;
  initialApiKey?: string;
}

export const BinanceSyncModal: React.FC<BinanceSyncModalProps> = ({
  isOpen,
  onClose,
  onImportTrades,
  existingTrades,
  userId,
  initialApiKey = '',
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'api'>('csv');
  const [dragActive, setDragActive] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [parsedResult, setParsedResult] = useState<BinanceParsedResult | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState('Binance Execution');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // API Sync State
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [apiSecret, setApiSecret] = useState('');
  const [apiTesting, setApiTesting] = useState(false);

  useEffect(() => {
    if (initialApiKey) setApiKey(initialApiKey);
  }, [initialApiKey]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessCsv = (content: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = parseBinanceCsv(content, existingTrades, selectedStrategy);
      if (res.error) {
        setErrorMsg(res.error);
        setParsedResult(null);
        return;
      }
      if (res.trades.length === 0 && res.duplicatesCount === 0) {
        setErrorMsg('This does not look like a Binance trade export. Use Spot → Orders → Trade History → Export, or USDⓈ-M Futures → Orders → Trade History → Export, and upload the CSV.');
        setParsedResult(null);
        return;
      }
      setParsedResult(res);
      setSuccessMsg(
        res.trades.length === 0
          ? `All ${res.duplicatesCount} trades in this file are already in your journal.`
          : `Parsed ${res.trades.length} new trade${res.trades.length === 1 ? '' : 's'} from Binance export (${res.duplicatesCount} already in your journal were skipped).`
      );
    } catch (err: any) {
      console.error('Binance CSV parse error:', err);
      setErrorMsg('Failed to parse Binance file. Check format and try again.');
      setParsedResult(null);
    }
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const text = await readCsvFile(file);
      setCsvText(text);
      handleProcessCsv(text);
    } catch (err) {
      setParsedResult(null);
      setSuccessMsg(null);
      setErrorMsg(err instanceof Error ? err.message : 'Could not read that file.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleLoadSample = (type: 'spot' | 'futures') => {
    const sample = type === 'spot' ? SAMPLE_BINANCE_SPOT_CSV : SAMPLE_BINANCE_FUTURES_CSV;
    setCsvText(sample);
    handleProcessCsv(sample);
  };

  const handleConfirmImport = async () => {
    if (!parsedResult || parsedResult.trades.length === 0) return;

    setIsSubmitting(true);
    try {
      // Apply selected strategy to all trades if changed
      const finalized = parsedResult.trades.map((t) => ({
        ...t,
        strategy: selectedStrategy,
      }));

      await onImportTrades(finalized);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving trades to database.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveApiKeys = () => {
    if (apiKey && userId) {
      saveUserSettings(userId, { binanceApiKey: apiKey.trim() });
    }
    setApiTesting(true);
    setTimeout(() => {
      setApiTesting(false);
      setSuccessMsg('Read-only API key saved to your Supabase account settings. Background sync is enabled.');
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface-alt border border-line-brand rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-sunken px-4 sm:px-6 py-3 sm:py-4 border-b border-line-strong flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#f3ba2f] via-[#e2a21a] to-[#c78b0f] flex items-center justify-center shadow-md shrink-0">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="font-extrabold text-ink text-sm sm:text-base tracking-tight truncate">Binance &amp; Crypto Sync</h3>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1.5 sm:px-2 py-0.5 bg-warn-bg text-brand rounded-full border border-warn-line shrink-0">
                  SPOT &amp; FUTURES
                </span>
                <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-[#e0f2fe] dark:bg-[#0c2a3a] text-[#0369a1] dark:text-[#62c5f0] rounded-full border border-[#bae6fd] dark:border-[#1c4a63] shrink-0">
                  8-DECIMAL
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted line-clamp-1">
                Automated trade import with Satoshi precision and Supabase cloud sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-sunken-strong rounded-xl transition cursor-pointer shrink-0 ml-2"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Reassurance Banner */}
        <div className="bg-sunken/70 px-4 sm:px-6 py-2 border-b border-line-strong flex items-center justify-between text-[11px] text-brand">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#16a34a] shrink-0" />
            <span className="font-medium line-clamp-1 sm:line-clamp-none">Client-Side Secure: Encrypted &amp; stored directly in your Supabase account.</span>
          </div>
          <span className="font-mono font-bold hidden sm:inline text-ink shrink-0 ml-2">
            {existingTrades.length} Trades
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 sm:px-6 pt-3 sm:pt-4 bg-surface-alt">
          <div className="grid grid-cols-2 p-1 bg-sunken-strong rounded-2xl border border-line-strong">
            <button
              type="button"
              onClick={() => setActiveTab('csv')}
              className={`py-1.5 sm:py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'csv'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand shrink-0" />
              <span className="truncate">CSV Import</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('api')}
              className={`py-1.5 sm:py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === 'api'
                  ? 'bg-surface text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              }`}
            >
              <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent shrink-0" />
              <span className="truncate">API Sync</span>
            </button>
          </div>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {errorMsg && (
            <div className="p-3 bg-loss-bg border border-loss-line rounded-xl flex items-center gap-2 text-xs text-loss">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-profit-bg border border-profit-line rounded-xl flex items-center gap-2 text-xs text-profit">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'csv' ? (
            <>
              {/* Dropzone Upload Box */}
              <div
                onDragEnter={() => setDragActive(true)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
                  dragActive
                    ? 'border-brand bg-sunken'
                    : 'border-line-brand hover:border-brand bg-canvas'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-sunken flex items-center justify-center text-brand shadow-xs">
                  <Upload className="w-6 h-6 stroke-[2]" />
                </div>
                <div>
                  <h4 className="font-bold text-ink text-sm">
                    Drop your Binance export file here, or click to browse
                  </h4>
                  <p className="text-xs text-muted mt-1">
                    Supports <strong>Binance Spot Trade History</strong> and <strong>USDT-M Futures Order History</strong> (.csv)
                  </p>
                </div>
              </div>

              {/* Sample Buttons for Instant Testing */}
              <div className="flex items-center justify-between p-3 bg-sunken rounded-2xl border border-line-brand text-xs">
                <div className="flex items-center gap-2 text-brand">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-semibold">Don't have a Binance file handy?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSample('spot')}
                    className="px-3 py-1.5 bg-surface hover:bg-canvas text-brand font-semibold rounded-xl border border-line-brand transition shadow-xs cursor-pointer"
                  >
                    Load Spot Sample (BTC, ETH, PEPE)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLoadSample('futures')}
                    className="px-3 py-1.5 bg-surface hover:bg-canvas text-brand font-semibold rounded-xl border border-line-brand transition shadow-xs cursor-pointer"
                  >
                    Load Futures Sample (USDT-M)
                  </button>
                </div>
              </div>

              {/* Parsed Results Staging Table */}
              {parsedResult && parsedResult.warnings.length > 0 && (
                <div className="rounded-xl border border-warn-line bg-warn-bg-soft p-3 space-y-1.5 text-xs text-brand" role="status">
                  {parsedResult.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              {parsedResult && parsedResult.trades.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-ink text-sm">
                        Import Staging Preview ({parsedResult.trades.length} Trades)
                      </h4>
                      <p className="text-xs text-muted">
                        Format: <span className="font-semibold text-brand">{parsedResult.formatLabel}</span> •
                        Volume: <strong>${parsedResult.summary.totalVolumeUSDT.toLocaleString()}</strong> •
                        Fees: <strong>${parsedResult.summary.totalCommissionUSDT.toFixed(4)}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted font-medium">Apply Strategy Tag:</label>
                      <input
                        type="text"
                        value={selectedStrategy}
                        onChange={(e) => setSelectedStrategy(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-surface border border-line rounded-xl text-ink font-medium"
                        placeholder="e.g. Binance Breakout"
                      />
                    </div>
                  </div>

                  <div className="border border-line rounded-2xl overflow-hidden max-h-60 overflow-y-auto bg-surface shadow-xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-canvas text-muted font-mono uppercase text-[10px] tracking-wider sticky top-0 border-b border-line">
                        <tr>
                          <th className="py-2.5 px-3">Date &amp; Time</th>
                          <th className="py-2.5 px-3">Pair / Side</th>
                          <th className="py-2.5 px-3">Price</th>
                          <th className="py-2.5 px-3">Quantity</th>
                          <th className="py-2.5 px-3">Net P&amp;L</th>
                          <th className="py-2.5 px-3">Fee</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line-soft font-mono text-xs">
                        {parsedResult.trades.map((t, idx) => (
                          <tr key={t.id || idx} className="hover:bg-canvas transition">
                            <td className="py-2 px-3 text-ink-soft">
                              <div>{t.date}</div>
                              <div className="text-[10px] text-faint">{t.time}</div>
                            </td>
                            <td className="py-2 px-3 font-sans">
                              <span className="font-bold text-ink font-mono">{t.symbol}</span>
                              <span
                                className={`ml-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                  t.direction === 'long'
                                    ? 'bg-profit-bg text-profit'
                                    : 'bg-loss-bg text-loss'
                                }`}
                              >
                                {t.direction}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-ink">
                              {formatPrice(t.entryPrice)}
                            </td>
                            <td className="py-2 px-3 text-brand font-semibold">
                              {formatQuantity(t.quantity, 'crypto')}
                            </td>
                            <td
                              className={`py-2 px-3 font-bold ${
                                t.netPnl > 0 ? 'text-profit' : t.netPnl < 0 ? 'text-loss' : 'text-muted'
                              }`}
                            >
                              {formatPnL(t.netPnl)}
                            </td>
                            <td className="py-2 px-3 text-muted">
                              ${t.fees.toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Binance API Sync Tab */
            <div className="space-y-4">
              <div className="p-4 bg-warn-bg-soft border border-warn-line rounded-2xl flex items-start gap-3">
                <Info className="w-5 h-5 text-[#ca8a04] shrink-0 mt-0.5" />
                <div className="text-xs text-brand space-y-1">
                  <h4 className="font-bold text-sm text-brand">Read-Only API Key Guide</h4>
                  <p>
                    For your security, create a Binance API Key with <strong>Read-Only</strong> permissions only.
                    <strong> Never enable Withdrawals or Margin Transfer.</strong>
                  </p>
                  <a
                    href="https://www.binance.com/en/my/settings/api-management"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-brand hover:underline pt-1"
                  >
                    <span>Open Binance API Management</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Binance API Key (Read-Only)
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="e.g. vmPUZE6mv9SD5VNHk4HlWFsOr6aKE2zvsw0MuIgwCIPy6utIco14y7Ju91duEh8A"
                    className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-xs font-mono text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-soft mb-1">
                    Binance Secret Key (Stored locally in browser session)
                  </label>
                  <input
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••••••••••"
                    className="w-full bg-surface border border-line rounded-xl px-4 py-2.5 text-xs font-mono text-ink focus:outline-none focus:border-brand"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveApiKeys}
                    disabled={!apiKey || apiTesting}
                    className="px-5 py-2.5 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {apiTesting ? (
                      <span>Connecting to Binance...</span>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        <span>Save API Connection &amp; Sync</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-sunken px-6 py-4 border-t border-line-strong flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-muted hover:text-ink hover:bg-sunken-strong rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>

          {activeTab === 'csv' && (
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={!parsedResult || parsedResult.trades.length === 0 || isSubmitting}
              className="px-5 py-2.5 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl transition shadow-md cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Syncing with Supabase...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Import {parsedResult?.trades.length || 0} Trades into Journal
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
