import React, { useState, useMemo } from 'react';
import { AssetClass } from '../types/trade';
import { calculatePositionSize, calculateRiskOfRuin } from '../utils/calculations';
import { formatQuantity, formatPrice } from '../utils/formatters';
import {
  Calculator,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  Copy,
  Check,
  Scale,
  ShieldAlert,
  TrendingUp,
  Percent,
  DollarSign,
  HelpCircle,
  Hash,
  Sliders,
} from 'lucide-react';

interface RiskCalculatorProps {
  currentBalance: number;
  onPreFillTrade?: (tradeParams: {
    symbol?: string;
    assetClass: AssetClass;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    direction: 'long' | 'short';
  }) => void;
}

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({ currentBalance, onPreFillTrade }) => {
  const [balance, setBalance] = useState<number>(currentBalance || 25000);
  const [riskMode, setRiskMode] = useState<'percent' | 'dollar'>('percent');
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [fixedDollarRisk, setFixedDollarRisk] = useState<number>(250);
  const [assetClass, setAssetClass] = useState<AssetClass>('stocks');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [symbol, setSymbol] = useState<string>('NVDA');
  const [entryPrice, setEntryPrice] = useState<number>(140.0);
  const [stopLoss, setStopLoss] = useState<number>(137.0);
  const [takeProfit, setTakeProfit] = useState<number>(147.5);
  const [leverage, setLeverage] = useState<number>(1);
  const [pointMultiplier, setPointMultiplier] = useState<number>(1);
  const [copied, setCopied] = useState<boolean>(false);

  // Quick preset helper
  const handlePresetSelect = (
    sym: string,
    type: AssetClass,
    entry: number,
    sl: number,
    tp: number,
    multiplier = 1
  ) => {
    setSymbol(sym);
    setAssetClass(type);
    setEntryPrice(entry);
    setStopLoss(sl);
    setTakeProfit(tp);
    setDirection(entry > sl ? 'long' : 'short');
    setPointMultiplier(multiplier);
  };

  // Keep fixed dollar risk and percent in sync when balance or mode toggles
  const activeDollarRisk = useMemo(() => {
    if (riskMode === 'dollar') return fixedDollarRisk;
    return Number(((balance * riskPercent) / 100).toFixed(2));
  }, [riskMode, fixedDollarRisk, balance, riskPercent]);

  // Main calculation
  const calcResult = useMemo(() => {
    return calculatePositionSize({
      accountBalance: balance,
      riskPercentage: riskPercent,
      fixedRiskAmount: fixedDollarRisk,
      riskMode,
      entryPrice,
      stopLossPrice: stopLoss,
      targetPrice: takeProfit,
      assetClass,
      leverage,
      pointMultiplier: assetClass === 'futures' ? pointMultiplier : undefined,
    });
  }, [
    balance,
    riskPercent,
    fixedDollarRisk,
    riskMode,
    entryPrice,
    stopLoss,
    takeProfit,
    assetClass,
    leverage,
    pointMultiplier,
  ]);

  // Copy quantity to clipboard
  const handleCopyQuantity = () => {
    navigator.clipboard.writeText(String(calcResult.positionSize));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Estimated Risk of Ruin
  const estRR = calcResult.rewardToRisk || 2.0;
  const effectiveRiskPct = balance > 0 ? (calcResult.riskAmount / balance) * 100 : 1;
  const riskOfRuin = useMemo(() => {
    return calculateRiskOfRuin(55, estRR, effectiveRiskPct);
  }, [estRR, effectiveRiskPct]);

  // Forex lot conversion helper
  const forexLots = useMemo(() => {
    if (assetClass !== 'forex') return null;
    const units = calcResult.positionSize;
    return {
      standard: (units / 100000).toFixed(2),
      mini: (units / 10000).toFixed(2),
      micro: (units / 1000).toFixed(2),
    };
  }, [assetClass, calcResult.positionSize]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#f5ede4] text-[#78350f] rounded-2xl border border-[#debfa8]">
              <Calculator className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#281d16] tracking-tight">
                  Position Size &amp; Quantity Calculator
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]">
                  Solves for Quantity
                </span>
              </div>
              <p className="text-xs text-[#7d695b] mt-1 max-w-2xl">
                Calculates the <strong>exact quantity (number of shares, contracts, lots, or coins)</strong> to buy or sell so that your total dollar loss is strictly capped if your stop-loss is hit.
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#8c7462] font-mono">Quick Presets:</span>
            <button
              onClick={() => handlePresetSelect('NVDA', 'stocks', 140, 137, 147.5, 1)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              NVDA (Stock)
            </button>
            <button
              onClick={() => handlePresetSelect('BTCUSDT', 'crypto', 68000, 66500, 72000, 1)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              BTC (Crypto)
            </button>
            <button
              onClick={() => handlePresetSelect('NQ', 'futures', 20500, 20450, 20650, 20)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              NQ Futures ($20/pt)
            </button>
            <button
              onClick={() => handlePresetSelect('EUR/USD', 'forex', 1.0850, 1.0820, 1.0920, 1)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              EUR/USD (Forex)
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Panel */}
        <div className="lg:col-span-7 bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs space-y-5">
          <div className="border-b border-[#ede6dc] pb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#634832] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#78350f]" />
              <span>1. Define Account &amp; Risk Parameters</span>
            </h3>
            <span className="text-xs text-[#78350f] font-mono font-medium">Input your limits</span>
          </div>

          {/* Account Balance & Risk Mode Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account Balance */}
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">
                Total Account Balance ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#8c7462] font-mono text-sm">$</span>
                <input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl pl-8 pr-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                  placeholder="25000"
                />
              </div>
            </div>

            {/* Risk Mode Switch: % of Account vs Fixed Dollar Amount */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-[#7d695b]">Risk Sizing Mode</label>
                <span className="text-xs font-mono font-bold text-[#78350f]">
                  ${activeDollarRisk.toFixed(2)} Risk Cap
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-[#fcfaf7] p-1 rounded-xl border border-[#e8dfd5]">
                <button
                  type="button"
                  onClick={() => setRiskMode('percent')}
                  className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    riskMode === 'percent'
                      ? 'bg-[#78350f] text-white shadow-xs'
                      : 'text-[#7d695b] hover:text-[#281d16]'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>% of Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRiskMode('dollar')}
                  className={`py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    riskMode === 'dollar'
                      ? 'bg-[#78350f] text-white shadow-xs'
                      : 'text-[#7d695b] hover:text-[#281d16]'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Fixed Dollar ($)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Risk Input Controls */}
          {riskMode === 'percent' ? (
            <div className="p-3.5 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-[#4a3b32]">Risk Percentage (% of ${balance.toLocaleString()})</span>
                <span className="text-xs font-mono font-bold text-[#78350f]">{riskPercent}% = ${activeDollarRisk.toFixed(2)}</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="15"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-white border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                />
                <span className="absolute right-3 top-2.5 text-[#8c7462] font-mono text-sm">%</span>
              </div>
              {/* Quick Risk Buttons */}
              <div className="flex gap-1.5 pt-1">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition cursor-pointer ${
                      riskPercent === pct
                        ? 'bg-[#78350f] text-white shadow-xs font-bold'
                        : 'bg-white text-[#7d695b] hover:text-[#281d16] border border-[#e2d8cb]'
                    }`}
                  >
                    {pct}% (${((balance * pct) / 100).toFixed(0)})
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-[#4a3b32]">Max Dollar Loss Limit ($)</span>
                <span className="text-xs font-mono font-bold text-[#78350f]">
                  {balance > 0 ? ((fixedDollarRisk / balance) * 100).toFixed(2) : 0}% of Account
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#8c7462] font-mono text-sm">$</span>
                <input
                  type="number"
                  step="10"
                  min="1"
                  value={fixedDollarRisk}
                  onChange={(e) => setFixedDollarRisk(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-white border border-[#e8dfd5] rounded-xl pl-8 pr-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                  placeholder="250"
                />
              </div>
              {/* Quick Dollar Buttons */}
              <div className="flex gap-1.5 pt-1">
                {[100, 200, 250, 500, 1000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFixedDollarRisk(amt)}
                    className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition cursor-pointer ${
                      fixedDollarRisk === amt
                        ? 'bg-[#78350f] text-white shadow-xs font-bold'
                        : 'bg-white text-[#7d695b] hover:text-[#281d16] border border-[#e2d8cb]'
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symbol, Asset & Direction */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#ede6dc]">
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Symbol / Ticker</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#281d16] font-mono text-sm uppercase focus:outline-none focus:border-[#78350f] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Asset Class</label>
              <select
                value={assetClass}
                onChange={(e) => {
                  const newType = e.target.value as AssetClass;
                  setAssetClass(newType);
                  if (newType === 'futures') setPointMultiplier(20);
                  else if (newType === 'options') setPointMultiplier(100);
                  else setPointMultiplier(1);
                }}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-sm focus:outline-none focus:border-[#78350f] transition capitalize"
              >
                <option value="stocks">Stocks (Shares)</option>
                <option value="crypto">Crypto (Coins)</option>
                <option value="futures">Futures (Contracts)</option>
                <option value="forex">Forex (Units/Lots)</option>
                <option value="options">Options (x100 Contracts)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Direction</label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#fcfaf7] p-1 rounded-xl border border-[#e8dfd5]">
                <button
                  type="button"
                  onClick={() => setDirection('long')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    direction === 'long'
                      ? 'bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb]'
                      : 'text-[#7d695b] hover:text-[#281d16]'
                  }`}
                >
                  LONG (Buy)
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('short')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    direction === 'short'
                      ? 'bg-[#fef2f2] text-[#b93829] border border-[#fecaca]'
                      : 'text-[#7d695b] hover:text-[#281d16]'
                  }`}
                >
                  SHORT (Sell)
                </button>
              </div>
            </div>
          </div>

          {/* Price Levels: Entry, Stop Loss, Target */}
          <div className="space-y-2 pt-2 border-t border-[#ede6dc]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#634832]">
                2. Price Levels (Determines Stop Distance)
              </span>
              <span className="text-xs font-mono text-[#8c7462]">
                Risk per Share: <strong className="text-[#b93829]">{formatPrice(calcResult.priceRiskPerUnit)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Entry Price ($)</label>
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Stop Loss Price ($)</label>
                <input
                  type="number"
                  step="any"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#fecaca] rounded-xl px-4 py-2 text-[#b93829] font-mono text-sm font-semibold focus:outline-none focus:border-[#b93829] transition"
                />
                <span className="text-[10px] text-[#b93829] font-mono block mt-1">
                  -{formatPrice(calcResult.priceRiskPerUnit)} ({calcResult.priceRiskPercent}%) from entry
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Target / TP Price ($)</label>
                <input
                  type="number"
                  step="any"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#c3e6cb] rounded-xl px-4 py-2 text-[#1e6b37] font-mono text-sm font-semibold focus:outline-none focus:border-[#1e6b37] transition"
                />
                <span className="text-[10px] text-[#1e6b37] font-mono block mt-1">
                  +{formatPrice(Math.abs(takeProfit - entryPrice))} per unit
                </span>
              </div>
            </div>
          </div>

          {/* Futures contract multiplier settings */}
          {assetClass === 'futures' && (
            <div className="p-3.5 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-[#4a3b32]">Futures Point Value / Multiplier</span>
                <span className="font-mono font-bold text-[#78350f]">${pointMultiplier} per 1.0 point</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: 'NQ ($20/pt)', val: 20 },
                  { label: 'MNQ ($2/pt)', val: 2 },
                  { label: 'ES ($50/pt)', val: 50 },
                  { label: 'MES ($5/pt)', val: 5 },
                  { label: 'GC ($100/pt)', val: 100 },
                  { label: 'CL ($1000/pt)', val: 1000 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPointMultiplier(item.val)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg transition cursor-pointer ${
                      pointMultiplier === item.val
                        ? 'bg-[#78350f] text-white shadow-xs font-bold'
                        : 'bg-white text-[#7d695b] border border-[#e2d8cb]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Leverage slider */}
          {(assetClass === 'crypto' || assetClass === 'forex') && (
            <div className="pt-2 border-t border-[#ede6dc]">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-[#7d695b]">Leverage / Margin Multiplier</span>
                <span className="font-mono font-bold text-[#78350f]">{leverage}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="50"
                value={leverage}
                onChange={(e) => setLeverage(Number(e.target.value))}
                className="w-full accent-[#78350f] cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Right: Output & Position Recommendations */}
        <div className="lg:col-span-5 space-y-5">
          {/* HERO OUTPUT CARD: QUANTITY / POSITION SIZE */}
          <div className="bg-white border-2 border-[#debfa8] rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#ede6dc] pb-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#78350f]">
                  Calculated Output
                </span>
                <h3 className="text-base font-extrabold text-[#281d16]">
                  Exact Position Size (Quantity)
                </h3>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb] font-mono font-bold">
                1 : {calcResult.rewardToRisk || 0} R:R
              </span>
            </div>

            {/* Giant Quantity Hero Display */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#faf7f2] via-[#f5ede4] to-[#ede3d8] border border-[#debfa8] text-center shadow-xs">
              <span className="text-xs text-[#78350f] font-bold uppercase tracking-wider block mb-1">
                Target Quantity to Buy / Sell
              </span>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-4xl sm:text-5xl font-black text-[#281d16] font-mono tracking-tight">
                  {formatQuantity(calcResult.positionSize, assetClass)}
                </span>
                <span className="text-base sm:text-lg font-bold text-[#78350f] uppercase">
                  {calcResult.unitLabel}
                </span>
              </div>

              {/* Copy Quantity Button */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyQuantity}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#faf7f2] text-[#4a3b32] border border-[#debfa8] shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#1e6b37]" />
                      <span className="text-[#1e6b37] font-bold">
                        Copied {formatQuantity(calcResult.positionSize, assetClass)}!
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#78350f]" />
                      <span>Copy Quantity ({formatQuantity(calcResult.positionSize, assetClass)})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Forex breakdown if applicable */}
              {forexLots && (
                <div className="mt-3 pt-3 border-t border-[#e2d8cb] text-xs font-mono text-[#634832] flex justify-center gap-3 flex-wrap">
                  <span><strong>{forexLots.standard}</strong> Std Lots</span>
                  <span>•</span>
                  <span><strong>{forexLots.mini}</strong> Mini Lots</span>
                  <span>•</span>
                  <span><strong>{forexLots.micro}</strong> Micro Lots</span>
                </div>
              )}
            </div>

            {/* Financial Metrics Summary Grid */}
            <div className="grid grid-cols-2 gap-2.5 mt-4 text-xs font-mono">
              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium">
                  Actual Loss at Stop
                </span>
                <span className="text-[#b93829] font-bold text-sm">
                  -${calcResult.actualRisk.toFixed(2)}
                </span>
                <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans">
                  ({calcResult.actualRiskPercent}% of account)
                </span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium">
                  Target Profit
                </span>
                <span className="text-[#1e6b37] font-bold text-sm">
                  +${calcResult.targetProfit?.toFixed(2) ?? '0.00'}
                </span>
                <span className="text-[10px] text-[#1e6b37] block mt-0.5 font-sans">
                  ({calcResult.rewardToRisk || 0}x risk)
                </span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium">
                  Total Position Value
                </span>
                <span className="text-[#281d16] font-bold text-sm">
                  ${calcResult.positionValue.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans">
                  {calcResult.positionSize} × ${entryPrice}
                </span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans font-medium">
                  Margin Required
                </span>
                <span className="text-[#281d16] font-bold text-sm">
                  ${calcResult.marginRequired.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#8c7462] block mt-0.5 font-sans">
                  {leverage > 1 ? `${leverage}x leverage` : '100% cash'}
                </span>
              </div>
            </div>

            {/* Over-leverage warning */}
            {calcResult.isOverLeveraged && (
              <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-start gap-2 text-[#b93829] text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#b93829] mt-0.5" />
                <div>
                  <strong>Over-Leverage Warning:</strong> Required margin (${calcResult.marginRequired.toLocaleString()}) exceeds your account balance (${balance.toLocaleString()}). Widen your stop-loss or reduce risk percentage.
                </div>
              </div>
            )}

            {/* Action button: Log this trade directly with this quantity */}
            {onPreFillTrade && (
              <button
                type="button"
                onClick={() =>
                  onPreFillTrade({
                    symbol,
                    assetClass,
                    entryPrice,
                    stopLoss,
                    takeProfit,
                    quantity: calcResult.positionSize,
                    direction,
                  })
                }
                className="w-full mt-4 py-3 px-4 bg-[#78350f] hover:bg-[#632909] text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Log Trade with This Quantity ({calcResult.positionSize} {calcResult.unitLabel})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mathematical Formula Breakdown Card */}
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#634832]">
              <HelpCircle className="w-4 h-4 text-[#78350f]" />
              <span>How This Quantity Is Calculated</span>
            </div>

            <div className="p-3 bg-[#faf7f2] rounded-xl border border-[#e2d8cb] font-mono text-xs text-[#281d16] space-y-1.5">
              <div className="text-[#78350f] font-bold text-center pb-1 border-b border-[#e2d8cb]">
                Quantity = Total Dollar Risk ÷ Risk Per Share
              </div>
              <div className="text-[11px] text-[#4a3b32] pt-1 space-y-1">
                <div>
                  • <strong>Step 1 (Max Risk):</strong> {calcResult.stepFormula?.step1Risk}
                </div>
                <div>
                  • <strong>Step 2 (Stop Distance):</strong> {calcResult.stepFormula?.step2Distance}
                </div>
                <div className="text-[#78350f] font-bold">
                  • <strong>Step 3 (Resulting Quantity):</strong> {calcResult.stepFormula?.step3Quantity}
                </div>
                <div className="text-[#b93829]">
                  • <strong>Step 4 (Stop Outcome):</strong> {calcResult.stepFormula?.step4LossAtStop}
                </div>
                {calcResult.stepFormula?.step5GainAtTarget && (
                  <div className="text-[#1e6b37]">
                    • <strong>Step 5 (Target Outcome):</strong> {calcResult.stepFormula.step5GainAtTarget}
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-[#7d695b] leading-relaxed">
              By sizing your position strictly according to your stop-loss distance, you ensure that no matter how volatile the market is, you never lose more than your allocated risk budget.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
