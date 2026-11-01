import React, { useState, useMemo } from 'react';
import { AssetClass } from '../types/trade';
import { calculatePositionSize, calculateRiskOfRuin } from '../utils/calculations';
import {
  ShieldAlert,
  Calculator,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  DollarSign,
  Percent,
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
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [assetClass, setAssetClass] = useState<AssetClass>('stocks');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [symbol, setSymbol] = useState<string>('NVDA');
  const [entryPrice, setEntryPrice] = useState<number>(130.0);
  const [stopLoss, setStopLoss] = useState<number>(127.0);
  const [takeProfit, setTakeProfit] = useState<number>(137.5);
  const [leverage, setLeverage] = useState<number>(1);

  // Asset presets
  const handlePresetSelect = (sym: string, type: AssetClass, entry: number, sl: number, tp: number) => {
    setSymbol(sym);
    setAssetClass(type);
    setEntryPrice(entry);
    setStopLoss(sl);
    setTakeProfit(tp);
    setDirection(entry > sl ? 'long' : 'short');
  };

  const calcResult = useMemo(() => {
    return calculatePositionSize({
      accountBalance: balance,
      riskPercentage: riskPercent,
      entryPrice,
      stopLossPrice: stopLoss,
      targetPrice: takeProfit,
      assetClass,
      leverage,
    });
  }, [balance, riskPercent, entryPrice, stopLoss, takeProfit, assetClass, leverage]);

  // Estimated Risk of Ruin
  const estRR = calcResult.rewardToRisk || 2.0;
  const riskOfRuin = useMemo(() => {
    return calculateRiskOfRuin(58, estRR, riskPercent);
  }, [estRR, riskPercent]);

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
              <h2 className="text-xl font-bold text-[#281d16] tracking-tight">Institutional Risk &amp; Sizing Engine</h2>
              <p className="text-xs text-[#7d695b] mt-1 max-w-xl">
                Never blow up your trading account. Calculate exact share and contract position sizing based strictly on
                dollar risk and stop-loss distance.
              </p>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[#8c7462] font-mono">Sample:</span>
            <button
              onClick={() => handlePresetSelect('NVDA', 'stocks', 140, 137, 147.5)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              NVDA Stock
            </button>
            <button
              onClick={() => handlePresetSelect('BTCUSDT', 'crypto', 70000, 68500, 74000)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              BTC Crypto
            </button>
            <button
              onClick={() => handlePresetSelect('NQ', 'futures', 20500, 20440, 20650)}
              className="px-2.5 py-1 text-xs bg-[#faf7f2] hover:bg-[#f2ece2] text-[#4a3b32] rounded-lg border border-[#e2d8cb] transition cursor-pointer"
            >
              NQ Futures
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Panel */}
        <div className="lg:col-span-7 bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs space-y-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#634832] border-b border-[#ede6dc] pb-3 flex items-center justify-between">
            <span>Trade Parameters</span>
            <span className="text-xs text-[#78350f] font-mono font-normal">Strict Position Sizing</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Account Balance */}
            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Account Balance ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#8c7462] font-mono text-sm">$</span>
                <input
                  type="number"
                  value={balance}
                  onChange={(e) => setBalance(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl pl-8 pr-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                  placeholder="25000"
                />
              </div>
            </div>

            {/* Risk % per Trade */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-[#7d695b]">Risk per Trade (%)</label>
                <span className="text-xs font-mono font-bold text-[#78350f]">
                  ${((balance * riskPercent) / 100).toFixed(2)}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(Number(e.target.value))}
                  className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#281d16] font-mono text-sm focus:outline-none focus:border-[#78350f] transition"
                />
                <span className="absolute right-3 top-2.5 text-[#8c7462] font-mono text-sm">%</span>
              </div>
              {/* Quick Risk Buttons */}
              <div className="flex gap-1.5 mt-2">
                {[0.5, 1.0, 1.5, 2.0].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setRiskPercent(pct)}
                    className={`flex-1 py-1 text-[11px] font-mono rounded-lg transition cursor-pointer ${
                      riskPercent === pct
                        ? 'bg-[#78350f] text-white shadow-xs font-bold'
                        : 'bg-[#faf7f2] text-[#7d695b] hover:text-[#281d16] border border-[#e2d8cb]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>
          </div>

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
                onChange={(e) => setAssetClass(e.target.value as AssetClass)}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-3 py-2 text-[#281d16] text-sm focus:outline-none focus:border-[#78350f] transition capitalize"
              >
                <option value="stocks">Stocks</option>
                <option value="crypto">Crypto</option>
                <option value="forex">Forex</option>
                <option value="futures">Futures</option>
                <option value="options">Options</option>
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
                  LONG
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
                  SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Price Levels: Entry, Stop Loss, Target */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#ede6dc]">
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
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Stop Loss ($)</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#b93829] font-mono text-sm focus:outline-none focus:border-[#b93829] transition"
              />
              <span className="text-[10px] text-[#8c7462] font-mono block mt-1">
                Risk: ${calcResult.priceRiskPerUnit.toFixed(2)} ({calcResult.priceRiskPercent}%)
              </span>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#7d695b] mb-1.5">Target / TP ($)</label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
                className="w-full bg-[#fcfaf7] border border-[#e8dfd5] rounded-xl px-4 py-2 text-[#1e6b37] font-mono text-sm focus:outline-none focus:border-[#1e6b37] transition"
              />
              <span className="text-[10px] text-[#8c7462] font-mono block mt-1">
                Reward: ${Math.abs(takeProfit - entryPrice).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Leverage slider */}
          {(assetClass === 'crypto' || assetClass === 'forex' || assetClass === 'futures') && (
            <div className="pt-2 border-t border-[#ede6dc]">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-[#7d695b]">Leverage / Buying Power Multiplier</span>
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
          <div className="bg-white border border-[#e8dfd5] rounded-2xl p-6 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#634832] border-b border-[#ede6dc] pb-3 flex items-center justify-between">
              <span>Sizing Execution Output</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#edf7ed] text-[#1e6b37] border border-[#c3e6cb] font-mono font-semibold">
                1 : {calcResult.rewardToRisk || 0} R:R
              </span>
            </h3>

            {/* Main recommendation card */}
            <div className="mt-4 p-4 rounded-xl bg-[#fcfaf7] border border-[#debfa8]">
              <span className="text-xs text-[#78350f] font-semibold block mb-1">Recommended Position Size</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#281d16] font-mono tracking-tight">
                  {calcResult.positionSize.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-[#7d695b] uppercase">
                  {assetClass === 'crypto' ? 'Coins' : assetClass === 'forex' ? 'Units' : 'Shares / Contracts'}
                </span>
              </div>
              <div className="text-xs text-[#8c7462] font-mono mt-1">
                Position Dollar Value: ${calcResult.positionValue.toLocaleString()}
              </div>
            </div>

            {/* Metric Grid */}
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Cash at Risk</span>
                <span className="text-[#b93829] font-bold text-sm">
                  -${calcResult.riskAmount.toFixed(2)} ({riskPercent}%)
                </span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Target Profit</span>
                <span className="text-[#1e6b37] font-bold text-sm">
                  +${calcResult.targetProfit?.toFixed(2) ?? '0.00'}
                </span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Margin Required</span>
                <span className="text-[#281d16] font-bold text-sm">${calcResult.marginRequired.toLocaleString()}</span>
              </div>

              <div className="p-3 bg-[#fcfaf7] rounded-xl border border-[#ede6dc]">
                <span className="text-[#8c7462] block text-[10px] uppercase font-sans">Risk of Ruin Est.</span>
                <span className={`font-bold text-sm ${riskOfRuin > 5 ? 'text-[#b45309]' : 'text-[#1e6b37]'}`}>
                  {riskOfRuin}%
                </span>
              </div>
            </div>

            {/* Over-leverage warning */}
            {calcResult.isOverLeveraged && (
              <div className="mt-4 p-3 bg-[#fef2f2] border border-[#fecaca] rounded-xl flex items-start gap-2 text-[#b93829] text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-[#b93829] mt-0.5" />
                <div>
                  <strong>Over-Leverage Warning:</strong> Required margin (${calcResult.marginRequired}) exceeds current
                  balance (${balance}). Increase stop-loss cushion or reduce risk percentage.
                </div>
              </div>
            )}

            {/* Action button: Log this trade directly */}
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
                className="w-full mt-5 py-3 px-4 bg-[#78350f] hover:bg-[#632909] text-white font-semibold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Log Trade with This Position</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Risk Rules Card */}
          <div className="bg-[#faf7f2] border border-[#e2d8cb] rounded-2xl p-4 text-xs space-y-2 text-[#7d695b]">
            <div className="font-semibold text-[#281d16] flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1e6b37]" />
              <span>The 1% Golden Rule</span>
            </div>
            <p>
              Professional hedge funds rarely risk more than <strong>1.0% to 2.0%</strong> of net liquidating capital on
              any individual setup. This guarantees you can withstand a 10-trade losing streak and still retain 90%+ of
              your account equity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
