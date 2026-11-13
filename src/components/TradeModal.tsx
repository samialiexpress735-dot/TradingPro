import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Trade, AssetClass, TradeDirection, TradeStatus, EmotionalState, TradeMistake, MarketSession, Strategy,
} from '../types/trade';
import { calculateTradeMetrics } from '../utils/calculations';
import { detectAutoMarketSession } from '../utils/sessionHelper';
import { localDateString, localTimeString } from '../utils/dateHelpers';
import { compressImageToDataUrl } from '../utils/imageHelpers';
import confetti from 'canvas-confetti';
import { X, Star, Upload, Sparkles, AlertCircle, Check } from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trade: Trade) => void;
  initialTrade?: Partial<Trade> | null;
  strategies: Strategy[];
  /** true when initialTrade is an existing journal entry (false for new / duplicated / calculator pre-fills). */
  isEditing?: boolean;
}

/** Numeric fields are kept as STRINGS while typing so they can be cleared (Number('') === 0 made that impossible). */
interface FormState {
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  status: TradeStatus;
  date: string;
  time: string;
  exitDate: string;
  exitTime: string;
  entryPrice: string;
  exitPrice: string;
  quantity: string;
  stopLoss: string;
  takeProfit: string;
  fees: string;
  strategy: string;
  customStrategy: string;
  rating: number;
  emotion: EmotionalState;
  mistake: TradeMistake;
  marketSession: MarketSession;
  notes: string;
  chartUrl: string;
}

const numStr = (n: number | undefined | null) => (n === undefined || n === null || Number.isNaN(n) ? '' : String(n));
const toNum = (s: string) => (s.trim() === '' ? NaN : Number(s));

/** Build the COMPLETE form from a trade (or defaults). Every field is set, so nothing can leak from a previous trade. */
function buildForm(t: Partial<Trade> | null | undefined, strategies: Strategy[]): FormState {
  const now = new Date();
  const today = localDateString(now);
  const nowTime = localTimeString(now);
  const known = t?.strategy && strategies.some((s) => s.name === t.strategy);
  return {
    symbol: t?.symbol ?? '',
    assetClass: t?.assetClass ?? 'stocks',
    direction: t?.direction ?? 'long',
    status: t?.status ?? 'closed',
    date: t?.date ?? today,
    time: t?.time ?? nowTime,
    exitDate: t?.exitDate ?? t?.date ?? today,
    exitTime: t?.exitTime ?? nowTime,
    entryPrice: numStr(t?.entryPrice),
    exitPrice: t?.status === 'open' ? '' : numStr(t?.exitPrice),
    quantity: numStr(t?.quantity),
    // stop/target equal to the entry price means "none recorded" (imports, or saved with the field blank)
    stopLoss: t?.stopLoss !== undefined && t.stopLoss === t.entryPrice ? '' : numStr(t?.stopLoss),
    takeProfit: t?.takeProfit !== undefined && t.takeProfit === t.entryPrice ? '' : numStr(t?.takeProfit),
    fees: numStr(t?.fees),
    strategy: known || !t?.strategy ? (t?.strategy ?? strategies[0]?.name ?? '') : 'other',
    customStrategy: !known && t?.strategy ? t.strategy : '',
    rating: t?.rating ?? 3,
    emotion: t?.emotion ?? 'Disciplined',
    mistake: t?.mistake ?? 'Followed Plan',
    marketSession: t?.marketSession ?? detectAutoMarketSession(),
    notes: t?.notes ?? '',
    chartUrl: t?.chartUrl ?? '',
  };
}

const QUICK_COINS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT', 'SUIUSDT', 'PEPEUSDT'];

const inputBase = 'w-full bg-surface-alt border rounded-xl px-3 py-2 text-ink font-mono text-xs focus:outline-none focus:border-brand';
const fieldCls = (invalid: boolean, extra = '') => `${inputBase} ${invalid ? 'border-loss' : 'border-line'} ${extra}`;

const TradeModalForm: React.FC<TradeModalProps> = ({ onClose, onSave, initialTrade, strategies, isEditing }) => {
  const [f, setF] = useState<FormState>(() => buildForm(initialTrade, strategies));
  const [attempted, setAttempted] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const savedRef = useRef(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const entry = toNum(f.entryPrice);
  const exit = toNum(f.exitPrice);
  const qty = toNum(f.quantity);
  const stop = toNum(f.stopLoss);
  const target = toNum(f.takeProfit);
  const fees = f.fees.trim() === '' ? 0 : Number(f.fees);
  const isClosed = f.status === 'closed';

  // Stop / target are optional: blank = "none recorded" (stored as the entry price => 0R, no fake plan)
  const stopEff = Number.isFinite(stop) ? stop : entry;
  const targetEff = Number.isFinite(target) ? target : entry;

  const errors = useMemo(() => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!f.symbol.trim()) e.symbol = 'Enter a ticker or pair.';
    if (!(entry > 0)) e.entryPrice = 'Enter an entry price above 0.';
    if (!(qty > 0)) e.quantity = 'Enter a quantity above 0.';
    if (isClosed && !(exit > 0)) e.exitPrice = 'Enter the exit price above 0.';
    if (Number.isFinite(stop) && stop <= 0) e.stopLoss = 'Stop must be above 0 (or leave blank).';
    if (!Number.isFinite(fees) || fees < 0) e.fees = 'Fees must be 0 or more.';
    if (!f.date) e.date = 'Pick the entry date.';
    if (isClosed) {
      if (!f.exitDate) e.exitDate = 'Pick the exit date.';
      else if (f.date && new Date(`${f.exitDate}T${f.exitTime || '00:00'}`) < new Date(`${f.date}T${f.time || '00:00'}`)) {
        e.exitDate = 'Exit is before the entry.';
      }
    }
    return e;
  }, [f.symbol, f.date, f.time, f.exitDate, f.exitTime, entry, qty, exit, stop, fees, isClosed]);

  // Non-blocking hints
  const warnings: string[] = [];
  if (entry > 0 && Number.isFinite(stop) && stop > 0) {
    if (f.direction === 'long' && stop >= entry) warnings.push('For a long, the stop is usually below your entry.');
    if (f.direction === 'short' && stop <= entry) warnings.push('For a short, the stop is usually above your entry.');
  }
  if (entry > 0 && Number.isFinite(target) && target > 0) {
    if (f.direction === 'long' && target <= entry) warnings.push('For a long, the target is usually above your entry.');
    if (f.direction === 'short' && target >= entry) warnings.push('For a short, the target is usually below your entry.');
  }

  const effectiveExit = isClosed ? exit : entry;
  const valid = Object.keys(errors).length === 0;
  const metrics = calculateTradeMetrics({
    direction: f.direction,
    entryPrice: valid || entry > 0 ? entry : 0,
    exitPrice: Number.isFinite(effectiveExit) ? effectiveExit : 0,
    quantity: qty > 0 ? qty : 0,
    stopLoss: stopEff,
    takeProfit: targetEff,
    fees: Number.isFinite(fees) ? fees : 0,
  });
  const showMetrics = entry > 0 && qty > 0 && (!isClosed || exit > 0);

  const handleAssetChange = (next: AssetClass) => {
    setF((prev) => {
      let symbol = prev.symbol;
      const clean = symbol.replace(/\.P$/i, '');
      // Only the symbol's perpetual suffix follows the asset class. Prices and quantity are NEVER touched.
      if (next === 'futures' && /USDT$|USDC$|BUSD$/i.test(clean)) symbol = `${clean}.P`;
      else if (next !== 'futures' && /\.P$/i.test(symbol)) symbol = clean;
      const crypto = next === 'futures' || next === 'crypto';
      const wasCrypto = prev.assetClass === 'futures' || prev.assetClass === 'crypto';
      const marketSession: MarketSession = crypto ? '24/7 Crypto' : wasCrypto ? detectAutoMarketSession() : prev.marketSession;
      return { ...prev, assetClass: next, symbol, marketSession };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadError('');
    try {
      set('chartUrl', await compressImageToDataUrl(file));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    }
  };

  const focusFirstError = () => {
    const order: (keyof FormState)[] = ['symbol', 'entryPrice', 'exitPrice', 'quantity', 'stopLoss', 'fees', 'date', 'exitDate'];
    const first = order.find((k) => errors[k]);
    if (first) document.getElementById(`tm-${first}`)?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (savedRef.current) return; // no double submits
    setAttempted(true);
    if (!valid) { focusFirstError(); return; }
    savedRef.current = true;

    const finalStrategy = f.strategy === 'other' ? f.customStrategy.trim() || 'Custom' : f.strategy;
    const open = f.status === 'open';
    const tradeToSave: Trade = {
      id: initialTrade?.id || `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: f.date,
      time: f.time || '00:00',
      exitDate: open ? undefined : f.exitDate,
      exitTime: open ? undefined : f.exitTime || '00:00',
      symbol: f.symbol.toUpperCase().trim(),
      assetClass: f.assetClass,
      direction: f.direction,
      status: f.status,
      outcome: open ? 'open' : metrics.outcome,
      entryPrice: entry,
      exitPrice: open ? entry : exit,
      quantity: qty,
      stopLoss: stopEff,
      takeProfit: targetEff,
      fees,
      grossPnl: open ? 0 : metrics.grossPnl,
      netPnl: open ? 0 : metrics.netPnl,
      roi: open ? 0 : metrics.roi,
      plannedRR: metrics.plannedRR,
      realizedRR: open ? 0 : metrics.realizedRR,
      strategy: finalStrategy,
      rating: f.rating,
      emotion: f.emotion,
      mistake: f.mistake,
      notes: f.notes,
      chartUrl: f.chartUrl,
      marketSession: f.marketSession,
    };

    if (!open && metrics.netPnl > 100) {
      try { confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } }); } catch { /* decorative */ }
    }
    onSave(tradeToSave);
    onClose();
  };

  const err = (k: keyof FormState) => (attempted ? errors[k] : undefined);
  const Err: React.FC<{ k: keyof FormState }> = ({ k }) =>
    err(k) ? <p className="mt-1 text-[11px] text-loss flex items-center gap-1" role="alert"><AlertCircle className="w-3 h-3 shrink-0" />{err(k)}</p> : null;
  const crypto = f.assetClass === 'futures' || f.assetClass === 'crypto';
  const coins = QUICK_COINS.map((c) => (f.assetClass === 'futures' ? `${c}.P` : c));
  const money = (n: number) => `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-inverse/50 backdrop-blur-xs overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="trade-modal-title">
      <div className="bg-surface border border-line rounded-2xl max-w-3xl w-full p-4 sm:p-6 shadow-2xl relative my-auto animate-fade-in text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-soft pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sunken text-brand rounded-xl border border-line-brand"><Sparkles className="w-5 h-5" /></div>
            <div>
              <h2 id="trade-modal-title" className="text-lg font-bold text-ink">{isEditing ? 'Edit Trade Entry' : 'Log New Trade'}</h2>
              <p className="text-xs text-muted">Record execution, psychological mindset, and metrics</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-ink p-1.5 rounded-xl hover:bg-sunken transition cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Live metrics */}
        <div className="mb-5 p-3.5 rounded-xl bg-surface-alt border border-line-soft grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-faint block text-[10px] uppercase font-sans">Net P&amp;L</span>
            <span className={`text-base font-bold ${!isClosed ? 'text-brand' : !showMetrics ? 'text-faint' : metrics.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {!isClosed ? 'OPEN' : showMetrics ? money(metrics.netPnl) : '—'}
            </span>
          </div>
          <div>
            <span className="text-faint block text-[10px] uppercase font-sans">Return (ROI)</span>
            <span className={`text-base font-bold ${!isClosed || !showMetrics ? 'text-faint' : metrics.roi >= 0 ? 'text-profit' : 'text-loss'}`}>
              {!isClosed || !showMetrics ? '—' : `${metrics.roi >= 0 ? '+' : ''}${metrics.roi}%`}
            </span>
          </div>
          <div>
            <span className="text-faint block text-[10px] uppercase font-sans">Planned R:R</span>
            <span className="text-base font-bold text-ink">{showMetrics && Number.isFinite(stop) ? `1 : ${metrics.plannedRR}` : '—'}</span>
          </div>
          <div>
            <span className="text-faint block text-[10px] uppercase font-sans">Realized R</span>
            <span className={`text-base font-bold ${!isClosed || !showMetrics || !Number.isFinite(stop) ? 'text-faint' : metrics.realizedRR >= 0 ? 'text-profit' : 'text-loss'}`}>
              {!isClosed ? 'In Play' : showMetrics && Number.isFinite(stop) ? `${metrics.realizedRR}R` : '—'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
          {/* Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="tm-symbol" className="block text-xs font-medium text-muted mb-1">Ticker / Symbol *</label>
              <input id="tm-symbol" type="text" autoFocus value={f.symbol} onChange={(e) => set('symbol', e.target.value.toUpperCase())} placeholder="e.g. NVDA" aria-invalid={!!err('symbol')} className={fieldCls(!!err('symbol'), 'text-sm uppercase')} />
              <Err k="symbol" />
            </div>
            <div>
              <label htmlFor="tm-assetClass" className="block text-xs font-medium text-muted mb-1">Asset Class</label>
              <select id="tm-assetClass" value={f.assetClass} onChange={(e) => handleAssetChange(e.target.value as AssetClass)} className="w-full bg-surface-alt border border-line rounded-xl px-2.5 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                <option value="stocks">Stocks</option>
                <option value="crypto">Crypto (Spot)</option>
                <option value="futures">Futures (Perpetual)</option>
                <option value="forex">Forex</option>
                <option value="options">Options</option>
              </select>
            </div>
            <div>
              <span className="block text-xs font-medium text-muted mb-1">Direction</span>
              <div className="grid grid-cols-2 gap-1 bg-surface-alt p-1 rounded-xl border border-line" role="group" aria-label="Direction">
                <button type="button" aria-pressed={f.direction === 'long'} onClick={() => set('direction', 'long')} className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${f.direction === 'long' ? 'bg-profit-bg text-profit border border-profit-line' : 'text-muted'}`}>LONG</button>
                <button type="button" aria-pressed={f.direction === 'short'} onClick={() => set('direction', 'short')} className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${f.direction === 'short' ? 'bg-loss-bg text-loss border border-loss-line' : 'text-muted'}`}>SHORT</button>
              </div>
            </div>
            <div>
              <label htmlFor="tm-status" className="block text-xs font-medium text-muted mb-1">Status</label>
              <select id="tm-status" value={f.status} onChange={(e) => set('status', e.target.value as TradeStatus)} className="w-full bg-surface-alt border border-line rounded-xl px-2.5 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                <option value="closed">Closed Trade</option>
                <option value="open">Open / Live</option>
              </select>
            </div>
          </div>

          {/* Binance quick symbols: set the SYMBOL only (never prices) */}
          {crypto && (
            <div className="p-2.5 bg-canvas rounded-xl border border-line space-y-1.5">
              <div className="text-[11px] font-semibold text-ink-soft flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f3ba2f]"></span>
                <span>{f.assetClass === 'futures' ? 'Binance USDT-M Futures (.P)' : 'Binance Spot Pairs'}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {coins.map((sym) => (
                  <button key={sym} type="button" onClick={() => set('symbol', sym)} className={`px-2 py-0.5 text-xs font-mono rounded-lg transition cursor-pointer ${f.symbol === sym ? 'bg-brand-solid text-white font-bold shadow-xs' : 'bg-surface text-ink-soft border border-line hover:bg-sunken-strong'}`}>{sym}</button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: dates */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="tm-date" className="block text-xs font-medium text-muted mb-1">Entry Date</label>
              <input id="tm-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} aria-invalid={!!err('date')} className={fieldCls(!!err('date'))} />
              <Err k="date" />
            </div>
            <div>
              <label htmlFor="tm-time" className="block text-xs font-medium text-muted mb-1">Entry Time</label>
              <input id="tm-time" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} className={fieldCls(false)} />
            </div>
            {isClosed && (
              <>
                <div>
                  <label htmlFor="tm-exitDate" className="block text-xs font-medium text-muted mb-1">Exit Date</label>
                  <input id="tm-exitDate" type="date" value={f.exitDate} onChange={(e) => set('exitDate', e.target.value)} aria-invalid={!!err('exitDate')} className={fieldCls(!!err('exitDate'))} />
                  <Err k="exitDate" />
                </div>
                <div>
                  <label htmlFor="tm-exitTime" className="block text-xs font-medium text-muted mb-1">Exit Time</label>
                  <input id="tm-exitTime" type="time" value={f.exitTime} onChange={(e) => set('exitTime', e.target.value)} className={fieldCls(false)} />
                </div>
              </>
            )}
          </div>

          {/* Row 3: prices & quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tm-entryPrice" className="block text-xs font-medium text-muted mb-1">Entry Price ($) *</label>
              <input id="tm-entryPrice" type="number" step="any" min="0" inputMode="decimal" value={f.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} aria-invalid={!!err('entryPrice')} className={fieldCls(!!err('entryPrice'))} />
              <Err k="entryPrice" />
            </div>
            {isClosed && (
              <div>
                <label htmlFor="tm-exitPrice" className="block text-xs font-medium text-muted mb-1">Exit Price ($) *</label>
                <input id="tm-exitPrice" type="number" step="any" min="0" inputMode="decimal" value={f.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} aria-invalid={!!err('exitPrice')} className={fieldCls(!!err('exitPrice'))} />
                <Err k="exitPrice" />
              </div>
            )}
            <div>
              <label htmlFor="tm-quantity" className="block text-xs font-medium text-muted mb-1">{crypto ? 'Quantity (Coins) *' : 'Quantity / Size *'}</label>
              <input id="tm-quantity" type="number" step="any" min="0" inputMode="decimal" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder={crypto ? '0.05 or 15.5' : '100'} aria-invalid={!!err('quantity')} className={fieldCls(!!err('quantity'))} />
              <Err k="quantity" />
            </div>
          </div>

          {/* Row 4: stop / target / fees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tm-stopLoss" className="block text-xs font-medium text-muted mb-1">Stop Loss ($) <span className="text-faint font-normal">optional</span></label>
              <input id="tm-stopLoss" type="number" step="any" min="0" inputMode="decimal" value={f.stopLoss} onChange={(e) => set('stopLoss', e.target.value)} placeholder="blank = no stop" aria-invalid={!!err('stopLoss')} className={fieldCls(!!err('stopLoss'), 'text-loss')} />
              <Err k="stopLoss" />
            </div>
            <div>
              <label htmlFor="tm-takeProfit" className="block text-xs font-medium text-muted mb-1">Take Profit Target ($) <span className="text-faint font-normal">optional</span></label>
              <input id="tm-takeProfit" type="number" step="any" min="0" inputMode="decimal" value={f.takeProfit} onChange={(e) => set('takeProfit', e.target.value)} className={fieldCls(false, 'text-profit')} />
            </div>
            <div>
              <label htmlFor="tm-fees" className="block text-xs font-medium text-muted mb-1">Commissions &amp; Fees ($)</label>
              <input id="tm-fees" type="number" step="any" min="0" inputMode="decimal" value={f.fees} onChange={(e) => set('fees', e.target.value)} placeholder="0" aria-invalid={!!err('fees')} className={fieldCls(!!err('fees'), 'text-muted')} />
              <Err k="fees" />
            </div>
          </div>

          {warnings.length > 0 && (
            <div className="rounded-xl border border-warn-line bg-warn-bg-soft p-2.5 space-y-1" role="status">
              {warnings.map((w) => <p key={w} className="text-[11px] text-brand flex items-start gap-1.5"><AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          {/* Row 5: strategy / session / rating */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="tm-strategy" className="block text-xs font-medium text-muted mb-1">Strategy / Setup Tag</label>
              <select id="tm-strategy" value={f.strategy} onChange={(e) => setF((p) => ({ ...p, strategy: e.target.value, customStrategy: e.target.value === 'other' ? p.customStrategy : '' }))} className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                {strategies.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                <option value="other">+ New Custom Strategy</option>
              </select>
              {f.strategy === 'other' && (
                <input type="text" placeholder="Enter custom setup name..." value={f.customStrategy} onChange={(e) => set('customStrategy', e.target.value)} aria-label="Custom strategy name" className="w-full mt-1.5 bg-surface-alt border border-line rounded-xl px-3 py-1.5 text-ink text-xs" />
              )}
            </div>
            <div>
              <label htmlFor="tm-session" className="block text-xs font-medium text-muted mb-1">Market Session</label>
              <select id="tm-session" value={f.marketSession} onChange={(e) => set('marketSession', e.target.value as MarketSession)} className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                <option value="Market Open (NY)">Market Open (NY)</option>
                <option value="Mid-Day">Mid-Day (11am-2pm)</option>
                <option value="Power Hour">Power Hour (3-4pm)</option>
                <option value="Pre-Market">Pre-Market</option>
                <option value="After-Hours">After-Hours</option>
                <option value="London Session">London Session</option>
                <option value="Asian Session">Asian Session</option>
                <option value="24/7 Crypto">24/7 Crypto</option>
              </select>
            </div>
            <div>
              <span className="block text-xs font-medium text-muted mb-1">Execution Quality (1-5)</span>
              <div className="flex items-center gap-1.5 py-1.5" role="group" aria-label="Execution quality">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} type="button" onClick={() => set('rating', star)} aria-label={`${star} star${star === 1 ? '' : 's'}`} aria-pressed={star === f.rating} className="transition cursor-pointer">
                    <Star className={`w-5 h-5 ${star <= f.rating ? 'fill-accent text-accent' : 'text-line-strong'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 6: psychology */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="tm-emotion" className="block text-xs font-medium text-muted mb-1">Psychology / Emotion</label>
              <select id="tm-emotion" value={f.emotion} onChange={(e) => set('emotion', e.target.value as EmotionalState)} className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                <option value="Disciplined">Disciplined / In The Zone</option>
                <option value="Patient">Patient / Waited for Setup</option>
                <option value="FOMO">FOMO / Chased Candle</option>
                <option value="Revenge">Revenge / Angry from Prior Loss</option>
                <option value="Hesitant">Hesitant / Second-Guessing</option>
                <option value="Greedy">Greedy / Refused to Take Profit</option>
                <option value="Fearful">Fearful / Panicked</option>
              </select>
            </div>
            <div>
              <label htmlFor="tm-mistake" className="block text-xs font-medium text-muted mb-1">Rule Adherence / Mistake</label>
              <select id="tm-mistake" value={f.mistake} onChange={(e) => set('mistake', e.target.value as TradeMistake)} className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand">
                <option value="Followed Plan">Followed Plan Perfectly</option>
                <option value="Moved Stop Loss">Moved Stop Loss</option>
                <option value="Exited Too Early">Exited Too Early (Paper Hands)</option>
                <option value="Held Loser Too Long">Held Loser Too Long</option>
                <option value="Overleveraged">Overleveraged / Sized Too Big</option>
                <option value="Chased Entry">Chased Entry / Bad Fill</option>
                <option value="Ignored HTF Trend">Ignored Higher Timeframe Trend</option>
                <option value="News Gamble">News Gamble</option>
                <option value="No Stop Loss">No Stop Loss Set</option>
                <option value="Revenge Trade">Revenge Trade</option>
                <option value="Flipped Bias">Flipped Bias Prematurely</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="tm-notes" className="block text-xs font-medium text-muted mb-1">Notes &amp; Thesis</label>
            <textarea id="tm-notes" rows={3} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Why did you take this trade? What was the context (catalyst, volume, level)? What would you do differently?" className="w-full bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand resize-none" />
          </div>

          {/* Screenshot */}
          <div>
            <label htmlFor="tm-chart" className="block text-xs font-medium text-muted mb-1">Chart Screenshot URL or Upload</label>
            <div className="flex gap-2">
              <input id="tm-chart" type="text" value={f.chartUrl.startsWith('data:') ? '(uploaded image)' : f.chartUrl} readOnly={f.chartUrl.startsWith('data:')} onChange={(e) => set('chartUrl', e.target.value)} placeholder="https://... or upload image" className="flex-1 min-w-0 bg-surface-alt border border-line rounded-xl px-3 py-2 text-ink text-xs focus:outline-none focus:border-brand font-mono" />
              <label className="px-3 py-2 bg-canvas hover:bg-sunken text-ink-soft text-xs rounded-xl border border-line cursor-pointer flex items-center gap-1.5 transition shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {uploadError && <p className="mt-1 text-[11px] text-loss" role="alert">{uploadError}</p>}
            {f.chartUrl && (
              <div className="mt-2 relative rounded-xl overflow-hidden border border-line-soft max-h-40">
                <img src={f.chartUrl} alt="Trade chart preview" className="w-full h-40 object-cover" />
                <button type="button" onClick={() => set('chartUrl', '')} className="absolute top-2 right-2 px-2 py-1 bg-inverse/70 hover:bg-inverse text-white rounded-lg text-xs cursor-pointer">Remove</button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-line-soft flex items-center justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-canvas hover:bg-sunken text-ink-soft text-xs font-semibold rounded-xl border border-line transition cursor-pointer">Cancel</button>
            <button type="submit" className="px-6 py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer">
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Record Trade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/**
 * The form is mounted only while the dialog is open, so every open starts from a freshly built state
 * (no values can leak from the previously edited trade) and App re-renders can't wipe what you're typing.
 */
export const TradeModal: React.FC<TradeModalProps> = (props) => (props.isOpen ? <TradeModalForm {...props} /> : null);
