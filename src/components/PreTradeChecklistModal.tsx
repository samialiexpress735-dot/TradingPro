import React, { useState } from 'react';
import { ShieldCheck, CheckSquare, Square, AlertCircle, ArrowRight, X } from 'lucide-react';

interface PreTradeChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedToTrade: () => void;
}

export const PreTradeChecklistModal: React.FC<PreTradeChecklistModalProps> = ({
  isOpen,
  onClose,
  onProceedToTrade,
}) => {
  const [items, setItems] = useState([
    {
      id: 1,
      title: 'Higher Timeframe Market Alignment',
      desc: 'Daily and 4-hour market structure supports trade direction or key liquidity has been swept.',
      checked: false,
    },
    {
      id: 2,
      title: 'Clear Technical Invalidation Point',
      desc: 'Hard stop-loss level is placed behind a structural swing or order block, not arbitrary.',
      checked: false,
    },
    {
      id: 3,
      title: 'Strict Position Sizing <= 1-2% Risk',
      desc: 'Calculated exact share/contract count based on dollar distance to stop-loss.',
      checked: false,
    },
    {
      id: 4,
      title: 'Minimum 2.0 : 1 Risk-to-Reward Potential',
      desc: 'Clear path to take-profit liquidity pool without immediate major structural resistance.',
      checked: false,
    },
    {
      id: 5,
      title: 'Economic Calendar News Check',
      desc: 'No high-impact tier 1 news (FOMC rate decision, CPI print, NFP, Fed speak) in next 15 minutes.',
      checked: false,
    },
    {
      id: 6,
      title: 'Mindset & Emotional Neutrality',
      desc: 'I am not revenge trading from a previous loss, not feeling FOMO, and fully accept the risk.',
      checked: false,
    },
  ]);

  if (!isOpen) return null;

  const toggleItem = (id: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const allChecked = items.every((i) => i.checked);
  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#281d16]/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-[#e8dfd5] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-left">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#e8dfd5] pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#edf7ed] text-[#1e6b37] rounded-xl border border-[#c3e6cb]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#281d16]">Pre-Flight Trading Discipline Checklist</h3>
              <p className="text-xs text-[#7d695b]">Enforce consistency before risking capital</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#7d695b] hover:text-[#281d16] p-1 transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs mb-1 font-mono">
            <span className="text-[#7d695b]">Rules Verified:</span>
            <span className={allChecked ? 'text-[#1e6b37] font-bold' : 'text-[#78350f] font-semibold'}>
              {checkedCount} of {items.length} ({Math.round((checkedCount / items.length) * 100)}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#f0e9df] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${allChecked ? 'bg-[#1e6b37]' : 'bg-[#78350f]'}`}
              style={{ width: `${(checkedCount / items.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`p-3 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                item.checked
                  ? 'bg-[#edf7ed] border-[#c3e6cb]'
                  : 'bg-[#fcfaf7] border-[#ede6dc] hover:border-[#c7b5a3]'
              }`}
            >
              <div className="mt-0.5">
                {item.checked ? (
                  <CheckSquare className="w-4 h-4 text-[#1e6b37]" />
                ) : (
                  <Square className="w-4 h-4 text-[#a89585]" />
                )}
              </div>
              <div className="text-xs">
                <span className={`font-bold block ${item.checked ? 'text-[#1e6b37]' : 'text-[#281d16]'}`}>
                  {item.title}
                </span>
                <span className="text-[#7d695b] leading-snug mt-0.5 block">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 pt-3 border-t border-[#e8dfd5] flex items-center justify-between">
          <button
            type="button"
            onClick={() => setItems((prev) => prev.map((i) => ({ ...i, checked: true })))}
            className="text-xs text-[#78350f] hover:text-[#522306] hover:underline font-mono cursor-pointer"
          >
            Check all
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-[#f0e9df] hover:bg-[#e4dacd] text-[#4a3b32] text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onProceedToTrade();
                onClose();
              }}
              disabled={!allChecked}
              className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center gap-1.5 transition ${
                allChecked
                  ? 'bg-[#78350f] hover:bg-[#632909] text-white shadow-md shadow-[#78350f]/20 cursor-pointer'
                  : 'bg-[#ede6dc] text-[#a89585] cursor-not-allowed'
              }`}
            >
              <span>Ready to Execute</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
