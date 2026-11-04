import React, { useState } from 'react';
import {
  X,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
  FileText,
  Trash2,
} from 'lucide-react';
import { CapitalTransaction } from '../types/trade';
import confetti from 'canvas-confetti';

interface DepositWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onApplyAdjustment: (newBalance: number, transaction: CapitalTransaction) => void;
  transactions: CapitalTransaction[];
  onDeleteTransaction?: (transactionId: string) => void;
}

export const DepositWithdrawModal: React.FC<DepositWithdrawModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  onApplyAdjustment,
  transactions = [],
  onDeleteTransaction,
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [amountStr, setAmountStr] = useState<string>('5000');
  const [memoCategory, setMemoCategory] = useState<string>('Simulated Account Top-Up');
  const [customMemo, setCustomMemo] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const parsedAmount = Math.abs(parseFloat(amountStr) || 0);

  const calculateNewBalance = (): number => {
    if (activeTab === 'deposit') {
      return Number((currentBalance + parsedAmount).toFixed(2));
    }
    return Number((currentBalance - parsedAmount).toFixed(2));
  };

  const newBalance = calculateNewBalance();
  const isWithdrawalValid = activeTab !== 'withdraw' || (parsedAmount > 0 && parsedAmount <= currentBalance);

  const depositPresets = [500, 1000, 2500, 5000, 10000, 25000];
  const withdrawPresets = [500, 1000, 2500, 5000, 10000];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than $0.');
      return;
    }

    if (activeTab === 'withdraw' && parsedAmount > currentBalance) {
      setErrorMsg(`Withdrawal amount cannot exceed current simulated balance ($${currentBalance.toLocaleString()}).`);
      return;
    }

    const transaction: CapitalTransaction = {
      id: `cap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      date: new Date().toISOString(),
      type: activeTab === 'deposit' ? 'deposit' : 'withdrawal',
      amount: parsedAmount,
      note: customMemo.trim() || memoCategory,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
    };

    onApplyAdjustment(newBalance, transaction);

    // Trigger subtle celebratory confetti on deposit
    if (activeTab === 'deposit') {
      try {
        confetti({
          particleCount: 40,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#16a34a', '#b45309', '#f59e0b'],
        });
      } catch {}
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-[#fcfaf7] border border-[#e8dfd5] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8dfd5] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#78350f] to-[#b45309] flex items-center justify-center text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#281d16] flex items-center gap-2">
                <span>Simulated Paper Capital</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-[#f5ede4] text-[#78350f] font-semibold border border-[#dac6b3]">
                  Virtual Funds
                </span>
              </h2>
              <p className="text-[11px] text-[#8c7462]">
                Adjust practice capital, record paper profit withdrawals, or reset challenge balance
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-[#8c7462] hover:text-[#281d16] hover:bg-[#f5ede4] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Balance Ribbon */}
        <div className="bg-[#f5ede4] border-b border-[#e8dfd5] px-5 py-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono text-[#8c7462] uppercase tracking-wider block">
              Current Base Capital
            </span>
            <div className="text-xl sm:text-2xl font-extrabold font-mono text-[#281d16]">
              ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-[#8c7462] uppercase tracking-wider block">
              Ledger Records
            </span>
            <span className="font-mono text-xs font-bold text-[#78350f]">
              {transactions.length} Transactions
            </span>
          </div>
        </div>

        {/* Segmented Tab Switcher */}
        <div className="px-5 pt-3 pb-2 bg-white border-b border-[#f0e8de]">
          <div className="grid grid-cols-3 gap-1 bg-[#ede6dc] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setActiveTab('deposit');
                setErrorMsg(null);
                setMemoCategory('Simulated Account Top-Up');
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'deposit'
                  ? 'bg-white text-[#1e6b37] shadow-xs'
                  : 'text-[#6e5849] hover:text-[#281d16]'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Deposit</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('withdraw');
                setErrorMsg(null);
                setMemoCategory('Profit Taking / Simulated Payout');
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'withdraw'
                  ? 'bg-white text-[#b93829] shadow-xs'
                  : 'text-[#6e5849] hover:text-[#281d16]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Withdraw</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-white text-[#78350f] shadow-xs'
                  : 'text-[#6e5849] hover:text-[#281d16]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Ledger ({transactions.length})</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'history' ? (
            /* History / Ledger View */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[#8c7462]">
                <span className="font-semibold">Simulated Capital Adjustments</span>
                <span className="font-mono text-[11px]">{transactions.length} total entries</span>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-10 bg-white border border-[#e8dfd5] rounded-xl p-6 space-y-2">
                  <Wallet className="w-8 h-8 text-[#a89585] mx-auto" />
                  <p className="text-xs font-medium text-[#281d16]">No capital adjustments recorded yet</p>
                  <p className="text-[11px] text-[#8c7462]">
                    Simulated deposits or profit withdrawals will appear here with timestamps and memos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const isDep = tx.type === 'deposit';
                    return (
                      <div
                        key={tx.id}
                        className="bg-white border border-[#e8dfd5] rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:border-[#dac6b3] transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isDep ? 'bg-[#edf7ed] text-[#1e6b37]' : 'bg-[#fff1f0] text-[#cf1322]'
                            }`}
                          >
                            {isDep ? (
                              <ArrowDownLeft className="w-4 h-4" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold text-[#281d16] truncate">
                              {tx.note || (isDep ? 'Deposit' : 'Withdrawal')}
                            </div>
                            <div className="text-[10px] text-[#8c7462] font-mono">
                              {new Date(tx.date).toLocaleDateString()} · {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div
                            className={`text-xs font-extrabold font-mono ${
                              isDep ? 'text-[#1e6b37]' : 'text-[#cf1322]'
                            }`}
                          >
                            {isDep ? '+' : '-'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-[10px] text-[#8c7462] font-mono">
                            Bal: ${tx.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </div>
                        </div>

                        {onDeleteTransaction && (
                          <button
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1 text-[#a89585] hover:text-rose-600 transition cursor-pointer"
                            title="Remove transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Deposit or Withdraw Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4a3b32] flex items-center justify-between">
                  <span>
                    {activeTab === 'deposit' ? 'Deposit Amount' : 'Withdrawal Amount'}
                  </span>
                  <span className="text-[10px] text-[#8c7462] font-normal font-mono">
                    USD Simulated
                  </span>
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-[#78350f] font-mono">
                    $
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder="5000"
                    autoFocus
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-white border border-[#dac6b3] focus:border-[#78350f] focus:ring-1 focus:ring-[#78350f] text-base font-bold font-mono text-[#281d16] outline-hidden"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono font-bold text-[#8c7462] block">
                  Quick Amount Presets
                </span>
                <div className="grid grid-cols-5 gap-1.5">
                  {(activeTab === 'deposit' ? depositPresets : withdrawPresets).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmountStr(String(preset))}
                      className={`py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                        parseFloat(amountStr) === preset
                          ? 'bg-[#78350f] text-white border-[#78350f]'
                          : 'bg-white hover:bg-[#f5ede4] text-[#4a3b32] border-[#dac6b3]'
                      }`}
                    >
                      {activeTab === 'deposit' ? '+' : '-'}${preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reason / Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4a3b32]">
                  Category / Reason
                </label>
                <select
                  value={memoCategory}
                  onChange={(e) => setMemoCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-[#dac6b3] focus:border-[#78350f] text-xs font-medium text-[#281d16] outline-hidden"
                >
                  {activeTab === 'deposit' ? (
                    <>
                      <option value="Simulated Account Top-Up">Simulated Account Top-Up</option>
                      <option value="New Capital Injection">New Capital Injection</option>
                      <option value="Prop Firm Account Reset">Prop Firm Challenge Reset</option>
                      <option value="Challenge Size Upgrade">Challenge Size Upgrade</option>
                      <option value="Personal Savings Deposit">Personal Savings Deposit</option>
                    </>
                  ) : (
                    <>
                      <option value="Profit Taking / Simulated Payout">Profit Taking / Simulated Payout</option>
                      <option value="Prop Firm Profit Split">Prop Firm Profit Split (80/20)</option>
                      <option value="Risk Reduction Drawdown">Risk Reduction / Capital Preservation</option>
                      <option value="Personal Expense Withdrawal">Simulated Expense Withdrawal</option>
                    </>
                  )}
                </select>
              </div>

              {/* Optional Custom Memo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#4a3b32] flex items-center justify-between">
                  <span>Memo Notes (Optional)</span>
                  <span className="text-[10px] text-[#8c7462] font-normal">e.g. Phase 2 funded pass payout</span>
                </label>
                <input
                  type="text"
                  value={customMemo}
                  onChange={(e) => setCustomMemo(e.target.value)}
                  placeholder="Optional journal memo..."
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#dac6b3] focus:border-[#78350f] text-xs text-[#281d16] outline-hidden placeholder:text-[#a89585]"
                />
              </div>

              {/* Live Preview Card */}
              <div className="p-3.5 bg-gradient-to-br from-[#faf6f0] to-[#f4ebe1] border border-[#dac6b3] rounded-xl space-y-2">
                <span className="text-[10px] font-mono uppercase font-bold text-[#78350f] block">
                  Capital Balance Projection
                </span>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e5849]">Starting Base:</span>
                  <span className="font-mono font-medium text-[#281d16]">
                    ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6e5849]">
                    {activeTab === 'deposit' ? 'Simulated Deposit:' : 'Simulated Withdrawal:'}
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      activeTab === 'deposit' ? 'text-[#1e6b37]' : 'text-[#cf1322]'
                    }`}
                  >
                    {activeTab === 'deposit' ? '+' : '-'}${parsedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t border-[#debfa8] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#281d16]">New Starting Balance:</span>
                  <span className="text-base font-extrabold font-mono text-[#78350f]">
                    ${newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!isWithdrawalValid || parsedAmount <= 0}
                className={`w-full py-2.5 rounded-xl text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  activeTab === 'deposit'
                    ? 'bg-[#1e6b37] hover:bg-[#16562b]'
                    : 'bg-[#cf1322] hover:bg-[#a8071a]'
                }`}
              >
                {activeTab === 'deposit' ? (
                  <>
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>Confirm Simulated Deposit (+${parsedAmount.toLocaleString()})</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Confirm Simulated Withdrawal (-${parsedAmount.toLocaleString()})</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
