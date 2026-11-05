import React, { useState } from 'react';
import {
  TrendingUp,
  BookOpen,
  Calculator,
  Layers,
  BarChart3,
  Code2,
  Plus,
  ShieldCheck,
  RotateCcw,
  Wallet,
  Sparkles,
  Radio,
  CalendarCheck,
  Globe,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserMenu } from './UserMenu';
import { Trade } from '../types/trade';

interface NavbarProps {
  activeTab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news';
  onSelectTab: (tab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news') => void;
  onOpenTradeModal: () => void;
  onOpenChecklistModal: () => void;
  onResetData: () => void;
  accountBalance: number;
  onUpdateBalance: (newBalance: number) => void;
  user: any | null;
  onOpenAuth: () => void;
  onSignOut: () => void;
  onSyncCloud: () => Promise<void>;
  isSyncing: boolean;
  trades: Trade[];
  onLoadDemoTrades?: () => void;
  onOpenDepositModal?: () => void;
  onOpenMonetization?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenTradeModal,
  onOpenChecklistModal,
  onResetData,
  accountBalance,
  onUpdateBalance,
  user,
  onOpenAuth,
  onSignOut,
  onSyncCloud,
  isSyncing,
  trades,
  onLoadDemoTrades,
  onOpenDepositModal,
  onOpenMonetization,
}) => {
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState(String(accountBalance));

  interface NavItem {
    id: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news';
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    hasBadge?: boolean;
  }

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: TrendingUp },
    { id: 'journal', label: 'Trade Journal', icon: BookOpen },
    { id: 'review', label: 'Daily Review', icon: CalendarCheck },
    { id: 'calculator', label: 'Risk Sizer', icon: Calculator },
    { id: 'playbook', label: 'Playbook', icon: Layers },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'news', label: 'Market News', icon: Radio, hasBadge: true },
  ];

  const handleSaveBalance = () => {
    const parsed = parseFloat(tempBalance);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateBalance(parsed);
    }
    setIsEditingBalance(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#fcfaf7]/95 backdrop-blur-xl border-b border-[#e8dfd5] px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 transition">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Brand Identity */}
        <div
          onClick={() => onSelectTab('dashboard')}
          className="flex items-center gap-2 cursor-pointer group select-none shrink-0"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-[#78350f] via-[#92400e] to-[#b45309] flex items-center justify-center shadow-md shadow-[#78350f]/20 group-hover:scale-105 transition">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-extrabold text-[#281d16] tracking-tight">Trade</span>
              <span className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-[#78350f] to-[#b45309] bg-clip-text text-transparent tracking-tight">
                Pulse
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-[#8c7462] uppercase tracking-widest font-mono block -mt-1 font-semibold">
              PRO JOURNAL
            </span>
          </div>
        </div>

        {/* Center: Main Navigation Tabs (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-[#ede6dc] p-1 rounded-2xl border border-[#ddcfbf]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 relative ${
                  isActive
                    ? 'bg-white text-[#281d16] shadow-sm border border-[#d2c0ad]'
                    : 'text-[#6e5849] hover:text-[#281d16] hover:bg-[#e4d9cc]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#92400e]' : 'text-[#8c7462]'}`} />
                <span>{item.label}</span>
                {item.hasBadge && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#92400e]"></span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Account Balance & Quick Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Account Balance Widget with Simulated Deposit Action */}
          <div className="bg-white border border-[#ddcfbf] px-2.5 sm:px-3 py-1.5 rounded-xl hidden sm:flex items-center gap-2 font-mono text-xs shadow-xs">
            <button
              onClick={onOpenDepositModal}
              className="flex items-center gap-1.5 text-[#281d16] hover:text-[#92400e] font-bold transition cursor-pointer"
              title="Deposit or withdraw simulated paper capital"
            >
              <Wallet className="w-3.5 h-3.5 text-[#8c7462]" />
              <span>${accountBalance.toLocaleString()}</span>
            </button>
            {onOpenDepositModal && (
              <button
                onClick={onOpenDepositModal}
                className="px-1.5 py-0.5 text-[10px] bg-[#f5ede4] hover:bg-[#ebd5c3] text-[#78350f] rounded font-bold border border-[#dac6b3] transition cursor-pointer"
                title="Deposit / Withdraw Paper Funds"
              >
                + Cash
              </button>
            )}
          </div>

          {/* Pre-trade checklist button */}
          <button
            onClick={onOpenChecklistModal}
            className="p-1.5 sm:p-2 text-[#6e5849] hover:text-[#281d16] bg-white hover:bg-[#ede6dc] rounded-xl border border-[#ddcfbf] transition hidden lg:flex items-center gap-1 shadow-xs"
            title="Pre-trade checklist"
          >
            <ShieldCheck className="w-4 h-4 text-[#2e7d32]" />
          </button>

          {/* Reset or Load Demo Data */}
          {trades.length === 0 && onLoadDemoTrades ? (
            <button
              onClick={onLoadDemoTrades}
              className="px-2.5 py-1.5 text-[11px] font-bold text-[#78350f] bg-[#f8ede3] hover:bg-[#ebd5c3] border border-[#d8bca6] rounded-xl transition shadow-xs hidden sm:flex items-center gap-1 cursor-pointer"
              title="Load demo sample trades"
            >
              <RotateCcw className="w-3 h-3 text-[#78350f]" />
              <span>Load Demo Data</span>
            </button>
          ) : (
            <button
              onClick={onResetData}
              className="p-1.5 sm:p-2 text-[#8c7462] hover:text-[#281d16] bg-white hover:bg-[#ede6dc] rounded-xl border border-[#ddcfbf] transition shadow-xs"
              title={trades.length > 0 ? 'Clear all trades from journal' : 'Reset sample trades'}
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          {/* User Auth & Cloud Sync Menu */}
          <UserMenu
            user={user}
            onOpenAuth={onOpenAuth}
            onSignOut={onSignOut}
            onSyncCloud={onSyncCloud}
            isSyncing={isSyncing}
            trades={trades}
            onOpenMonetization={onOpenMonetization}
          />

          {/* Google Verification & AdSense Monetization trigger */}
          {onOpenMonetization && (
            <button
              onClick={onOpenMonetization}
              className="p-1.5 sm:p-2 text-[#78350f] hover:text-[#92400e] bg-white hover:bg-[#ede6dc] rounded-xl border border-[#ddcfbf] transition hidden sm:flex items-center gap-1 shadow-xs cursor-pointer"
              title="Google Verification & AdSense Monetization"
            >
              <Globe className="w-4 h-4 text-[#92400e]" />
            </button>
          )}

          {/* PWA Install Button */}
          <PWAInstallButton compact={true} />

          {/* New Trade Primary CTA */}
          <button
            onClick={onOpenTradeModal}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-[#78350f] hover:bg-[#632909] text-white text-xs font-bold rounded-xl flex items-center gap-1 sm:gap-1.5 transition shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>

      {/* Mobile subnav - horizontally scrollable with smooth touch scrolling */}
      <div className="flex md:hidden items-center gap-1.5 mt-2 pt-2 border-t border-[#e8dfd5] overflow-x-auto no-scrollbar pb-1 text-[11px] px-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition shrink-0 whitespace-nowrap flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-white text-[#78350f] font-bold border-[#d2c0ad] shadow-xs'
                  : 'text-[#6e5849] border-transparent hover:text-[#281d16]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="whitespace-nowrap">{item.label}</span>
              {item.hasBadge && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#92400e] shrink-0"></span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
};
