import React, { useState, useEffect } from 'react';
import {
  Trade,
  AssetClass,
  TradeDirection,
  TradeStatus,
  EmotionalState,
  TradeMistake,
  MarketSession,
  Strategy,
} from '../types/trade';
import { calculateTradeMetrics } from '../utils/calculations';
import confetti from 'canvas-confetti';
import {
  X,
  Star,
  Upload,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Sparkles,
  AlertCircle,
  Check,
} from 'lucide-react';

interface TradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trade: Trade) => void;
  initialTrade?: Partial<Trade> | null;
  strategies: Strategy[];
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTrade,
  strategies,
}) => {
  const [symbol, setSymbol] = useState('NVDA');
  const [assetClass, setAssetClass] = useState<AssetClass>('stocks');
  const [direction, setDirection] = useState<TradeDirection>('long');
  const [status, setStatus] = useState<TradeStatus>('closed');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:45');
  const [exitDate, setExitDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exitTime, setExitTime] = useState('10:30');
  const [entryPrice, setEntryPrice] = useState<number>(130.0);
  const [exitPrice, setExitPrice] = useState<number>(135.0);
  const [quantity, setQuantity] = useState<number>(100);
  const [stopLoss, setStopLoss] = useState<number>(127.5);
  const [takeProfit, setTakeProfit] = useState<number>(136.0);
  const [fees, setFees] = useState<number>(1.5);
  const [strategy, setStrategy] = useState<string>(strategies[0]?.name || 'Breakout & Retest');
  const [customStrategy, setCustomStrategy] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [emotion, setEmotion] = useState<EmotionalState>('Disciplined');
  const [mistake, setMistake] = useState<TradeMistake>('Followed Plan');
  const [marketSession, setMarketSession] = useState<MarketSession>('Market Open (NY)');
  const [notes, setNotes] = useState('');
  const [chartUrl, setChartUrl] = useState('');

  // Populate when editing or pre-filled from Risk Calculator
  useEffect(() => {
    if (initialTrade) {
      if (initialTrade.symbol) setSymbol(initialTrade.symbol);
      if (initialTrade.assetClass) setAssetClass(initialTrade.assetClass);
      if (initialTrade.direction) setDirection(initialTrade.direction);
      if (initialTrade.status) setStatus(initialTrade.status);
      if (initialTrade.date) setDate(initialTrade.date);
      if (initialTrade.time) setTime(initialTrade.time);
      if (initialTrade.exitDate) setExitDate(initialTrade.exitDate);
      if (initialTrade.exitTime) setExitTime(initialTrade.exitTime);
      if (initialTrade.entryPrice !== undefined) setEntryPrice(initialTrade.entryPrice);
      if (initialTrade.exitPrice !== undefined) setExitPrice(initialTrade.exitPrice);
      if (initialTrade.quantity !== undefined) setQuantity(initialTrade.quantity);
      if (initialTrade.stopLoss !== undefined) setStopLoss(initialTrade.stopLoss);
      if (initialTrade.takeProfit !== undefined) setTakeProfit(initialTrade.takeProfit);
      if (initialTrade.fees !== undefined) setFees(initialTrade.fees);
      if (initialTrade.strategy) setStrategy(initialTrade.strategy);
      if (initialTrade.rating !== undefined) setRating(initialTrade.rating);
      if (initialTrade.emotion) setEmotion(initialTrade.emotion);
      if (initialTrade.mistake) setMistake(initialTrade.mistake);
      if (initialTrade.marketSession) setMarketSession(initialTrade.marketSession);
      if (initialTrade.notes) setNotes(initialTrade.notes);
      if (initialTrade.chartUrl) setChartUrl(initialTrade.chartUrl);
    }
  }, [initialTrade, isOpen]);

  // Live metric calculations
  const effectiveExit = status === 'open' ? entryPrice : exitPrice;
  const metrics = calculateTradeMetrics({
    direction,
    entryPrice,
    exitPrice: effectiveExit,
    quantity,
    stopLoss,
    takeProfit,
    fees,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setChartUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalStrategy = customStrategy.trim() ? customStrategy.trim() : strategy;

    const tradeToSave: Trade = {
      id: initialTrade?.id || `tr-${Date.now()}`,
      date,
      time,
      exitDate: status === 'closed' ? exitDate : undefined,
      exitTime: status === 'closed' ? exitTime : undefined,
      symbol: symbol.toUpperCase().trim(),
      assetClass,
      direction,
      status,
      outcome: status === 'open' ? 'open' : metrics.outcome,
      entryPrice,
      exitPrice: effectiveExit,
      quantity,
      stopLoss,
      takeProfit,
      fees,
      grossPnl: status === 'open' ? 0 : metrics.grossPnl,
      netPnl: status === 'open' ? 0 : metrics.netPnl,
      roi: status === 'open' ? 0 : metrics.roi,
      plannedRR: metrics.plannedRR,
      realizedRR: status === 'open' ? 0 : metrics.realizedRR,
      strategy: finalStrategy,
      rating,
      emotion,
      mistake,
      notes,
      chartUrl,
      marketSession,
    };

    if (metrics.netPnl > 100 && status === 'closed') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    onSave(tradeToSave);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#281d16]/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-[#e8dfd5] rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative my-auto animate-fade-in text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#ede6dc] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#f5ede4] text-[#78350f] rounded-xl border border-[#debfa8]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#281d16]">
                {initialTrade?.id ? 'Edit Trade Entry' : 'Log New Trade'}
              </h2>
              <p className="text-xs text-[#7d695b]">Record execution, psychological mindset, and metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#7d695b] hover:text-[#281d16] p-1.5 rounded-xl hover:bg-[#f5ede4] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Summary Bar */}
        <div className="mb-5 p-3.5 rounded-xl bg-[#fcfaf7] border border-[#ede6dc] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Net P&amp;L</span>
            <span
              className={`text-base font-bold ${
                status === 'open'
                  ? 'text-[#78350f]'
                  : metrics.netPnl >= 0
                  ? 'text-[#1e6b37]'
                  : 'text-[#b93829]'
              }`}
            >
              {status === 'open'
                ? 'OPEN'
                : `${metrics.netPnl >= 0 ? '+' : ''}$${metrics.netPnl.toFixed(2)}`}
            </span>
          </div>

          <div>
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Return (ROI)</span>
            <span
              className={`text-base font-bold ${
                metrics.roi >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'
              }`}
            >
              {status === 'open' ? '—' : `${metrics.roi >= 0 ? '+' : ''}${metrics.roi}%`}
            </span>
          </div>

          <div>
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Planned R:R</span>
            <span className="text-base font-bold text-[#78350f]">
              1 : {metrics.plannedRR}
            </span>
          </div>

          <div>
            <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Realized R</span>
            <span
              className={`text-base font-bold ${
                metrics.realizedRR >= 0 ? 'text-[#1e6b37]' : 'text-[#b93829]'
              }`}
            >
              {status === 'open' ? 'In Play' : `${metrics.realizedRR}R`}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
          {/* Row 1: Ticker, Asset, Direction, Status */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Ticker / Symbol *</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="NVDA"
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Asset Class</label>
              <select
                value={assetClass}
                onChange={(e) => {
                  const newType = e.target.value as AssetClass;
                  setAssetClass(newType);
                  if (newType === 'futures') {
                    if (symbol === 'NVDA' || symbol === 'AAPL' || symbol === 'BTC/USDT' || symbol === 'BTCUSDT') {
                      setSymbol('BTCUSDT.P');
                      setEntryPrice(68500);
                      setExitPrice(70500);
                      setStopLoss(67200);
                      setTakeProfit(71500);
                      setQuantity(0.05);
                    }
                    setMarketSession('24/7 Crypto');
                  } else if (newType === 'crypto') {
                    if (symbol === 'NVDA' || symbol === 'AAPL' || symbol === 'BTCUSDT.P') {
                      setSymbol('BTCUSDT');
                      setQuantity(0.05);
                    }
                    setMarketSession('24/7 Crypto');
                  }
                }}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] capitalize"
              >
                <option value="stocks">Stocks</option>
                <option value="crypto">Crypto (Spot)</option>
                <option value="futures">Futures (Perpetual)</option>
                <option value="forex">Forex</option>
                <option value="options">Options</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Direction</label>
              <div className="grid grid-cols-2 gap-1 bg-[#fcfaf7] p-1 rounded-xl border border-[#e8dfd5]">
                <button
                  type="button"
                  onClick={() => setDirection('long')}
                  className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    direction === 'long'
                      ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                      : 'text-[#7d695b]'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('short')}
                  className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    direction === 'short'
                      ? 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                      : 'text-[#7d695b]'
                  }`}
                >
                  SHORT
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TradeStatus)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] capitalize"
              >
                <option value="closed">Closed Trade</option>
                <option value="open">Open / Live</option>
              </select>
            </div>
          </div>

          {/* Binance Future & Spot Coins Quick Selector */}
          {(assetClass === 'futures' || assetClass === 'crypto') && (
            <div className="p-2.5 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#634832] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#f3ba2f]"></span>
                  <span>{assetClass === 'futures' ? 'Binance USDT-M Futures (.P)' : 'Binance Spot Pairs'}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {(assetClass === 'futures'
                  ? [
                      { sym: 'BTCUSDT.P', price: 68500, sl: 67200, tp: 71500, qty: 0.05 },
                      { sym: 'ETHUSDT.P', price: 2650, sl: 2580, tp: 2800, qty: 0.5 },
                      { sym: 'SOLUSDT.P', price: 178.50, sl: 172.00, tp: 195.00, qty: 5 },
                      { sym: 'BNBUSDT.P', price: 595, sl: 580, tp: 630, qty: 1.5 },
                      { sym: 'DOGEUSDT.P', price: 0.158, sl: 0.149, tp: 0.180, qty: 5000 },
                      { sym: 'XRPUSDT.P', price: 0.542, sl: 0.518, tp: 0.600, qty: 1000 },
                      { sym: 'SUIUSDT.P', price: 2.15, sl: 2.02, tp: 2.45, qty: 250 },
                      { sym: 'PEPEUSDT.P', price: 0.0000095, sl: 0.0000088, tp: 0.0000115, qty: 50000000 },
                    ]
                  : [
                      { sym: 'BTCUSDT', price: 68500, sl: 67200, tp: 71500, qty: 0.05 },
                      { sym: 'ETHUSDT', price: 2650, sl: 2580, tp: 2800, qty: 0.5 },
                      { sym: 'SOLUSDT', price: 178.50, sl: 172.00, tp: 195.00, qty: 5 },
                      { sym: 'BNBUSDT', price: 595, sl: 580, tp: 630, qty: 1.5 },
                      { sym: 'DOGEUSDT', price: 0.158, sl: 0.149, tp: 0.180, qty: 5000 },
                      { sym: 'XRPUSDT', price: 0.542, sl: 0.518, tp: 0.600, qty: 1000 },
                      { sym: 'SUIUSDT', price: 2.15, sl: 2.02, tp: 2.45, qty: 250 },
                      { sym: 'PEPEUSDT', price: 0.0000095, sl: 0.0000088, tp: 0.0000115, qty: 50000000 },
                    ]
                ).map((item) => (
                  <button
                    key={item.sym}
                    type="button"
                    onClick={() => {
                      setSymbol(item.sym);
                      setEntryPrice(item.price);
                      setExitPrice(direction === 'long' ? item.price * 1.03 : item.price * 0.97);
                      setStopLoss(item.sl);
                      setTakeProfit(item.tp);
                      setQuantity(item.qty);
                    }}
                    className={`px-2 py-0.5 text-xs font-mono rounded-lg transition cursor-pointer ${
                      symbol === item.sym
                        ? 'bg-[#78350f] text-white font-bold shadow-xs'
                        : 'bg-white text-[#634832] border border-[#e2d8cb] hover:bg-[#ede6dc]'
                    }`}
                  >
                    {item.sym}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Row 2: Dates and Times */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Entry Date</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs font-mono focus:outline-none focus:border-[#78350f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Entry Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs font-mono focus:outline-none focus:border-[#78350f]"
              />
            </div>
            {status === 'closed' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#7d695b] mb-1">Exit Date</label>
                  <input
                    type="date"
                    value={exitDate}
                    onChange={(e) => setExitDate(e.target.value)}
                    className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs font-mono focus:outline-none focus:border-[#78350f]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#7d695b] mb-1">Exit Time</label>
                  <input
                    type="time"
                    value={exitTime}
                    onChange={(e) => setExitTime(e.target.value)}
                    className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-2.5 py-2 text-[#281d16] text-xs font-mono focus:outline-none focus:border-[#78350f]"
                  />
                </div>
              </>
            )}
          </div>

          {/* Row 3: Prices & Quantity */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Entry Price ($) *</label>
              <input
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] font-mono text-xs focus:outline-none focus:border-[#78350f]"
              />
            </div>

            {status === 'closed' && (
              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1">Exit Price ($) *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={exitPrice}
                  onChange={(e) => setExitPrice(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] font-mono text-xs focus:outline-none focus:border-[#78350f]"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[#7d695b]">
                  {assetClass === 'futures' || assetClass === 'crypto'
                    ? 'Quantity (Coins) *'
                    : 'Quantity / Size *'}
                </label>
                {(assetClass === 'futures' || assetClass === 'crypto') && (
                  <span className="text-[10px] text-[#78350f] font-mono font-medium">8 Decimals</span>
                )}
              </div>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                placeholder={assetClass === 'futures' || assetClass === 'crypto' ? '0.05 or 15.5' : '100'}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] font-mono text-xs focus:outline-none focus:border-[#78350f]"
              />
            </div>
          </div>

          {/* Row 4: Stop Loss, Target, Fees */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Stop Loss ($) *</label>
              <input
                type="number"
                step="any"
                required
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#b93829] font-mono text-xs focus:outline-none focus:border-[#b93829]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Take Profit Target ($)</label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#1e6b37] font-mono text-xs focus:outline-none focus:border-[#1e6b37]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Commissions &amp; Fees ($)</label>
              <input
                type="number"
                step="any"
                value={fees}
                onChange={(e) => setFees(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#7d695b] font-mono text-xs focus:outline-none focus:border-[#78350f]"
              />
            </div>
          </div>

          {/* Row 5: Strategy, Market Session, Rating */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Strategy / Setup Tag</label>
              <select
                value={strategy}
                onChange={(e) => {
                  setStrategy(e.target.value);
                  if (e.target.value !== 'other') setCustomStrategy('');
                }}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
              >
                {strategies.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
                <option value="other">+ New Custom Strategy</option>
              </select>
              {strategy === 'other' && (
                <input
                  type="text"
                  placeholder="Enter custom setup name..."
                  value={customStrategy}
                  onChange={(e) => setCustomStrategy(e.target.value)}
                  className="w-full mt-1.5 bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-1.5 text-[#281d16] text-xs"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Market Session</label>
              <select
                value={marketSession}
                onChange={(e) => setMarketSession(e.target.value as MarketSession)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
              >
                <option value="Market Open (NY)">Market Open (NY)</option>
                <option value="Mid-Day">Mid-Day (11am-2pm)</option>
                <option value="Power Hour">Power Hour (3-4pm)</option>
                <option value="Pre-Market">Pre-Market</option>
                <option value="After-Hours">After-Hours</option>
                <option value="London Session">London Session</option>
                <option value="Asian Session">Asian Session</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Execution Quality (1-5)</label>
              <div className="flex items-center gap-1.5 py-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="text-[#dacfc3] hover:text-[#b45309] transition cursor-pointer"
                  >
                    <Star
                      className={`w-5 h-5 ${
                        star <= rating ? 'fill-[#b45309] text-[#b45309]' : 'text-[#dacfc3]'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 6: Mindset Psychology & Rule Adherence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Psychology / Emotion</label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value as EmotionalState)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
              >
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
              <label className="block text-xs font-medium text-[#7d695b] mb-1">Rule Adherence / Mistake</label>
              <select
                value={mistake}
                onChange={(e) => setMistake(e.target.value as TradeMistake)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f]"
              >
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

          {/* Trade Notes */}
          <div>
            <label className="block text-xs font-medium text-[#7d695b] mb-1">Notes &amp; Thesis</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why did you take this trade? What was the context (catalyst, volume, level)? What would you do differently?"
              className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] resize-none"
            />
          </div>

          {/* Screenshot / Chart URL */}
          <div>
            <label className="block text-xs font-medium text-[#7d695b] mb-1">Chart Screenshot URL or Upload</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={chartUrl}
                onChange={(e) => setChartUrl(e.target.value)}
                placeholder="https://... or upload image below"
                className="flex-1 bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-xs focus:outline-none focus:border-[#78350f] font-mono"
              />
              <label className="px-3 py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] text-xs rounded-xl border border-[#e2d8cb] cursor-pointer flex items-center gap-1.5 transition">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            {chartUrl && (
              <div className="mt-2 relative rounded-xl overflow-hidden border border-[#ede6dc] max-h-40 group">
                <img src={chartUrl} alt="Trade chart preview" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={() => setChartUrl('')}
                  className="absolute top-2 right-2 p-1 bg-[#281d16]/70 hover:bg-[#281d16] text-white rounded-lg text-xs cursor-pointer"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[#ede6dc] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] text-xs font-semibold rounded-xl border border-[#e2d8cb] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{initialTrade?.id ? 'Save Changes' : 'Record Trade'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
