import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { Trade } from '../types/trade';

interface NavbarProps {
  activeTab: 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news';
  /** Unread headlines in the live news feed (badge is hidden at 0). */
  newsBadgeCount?: number;
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
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  newsBadgeCount = 0,
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
}) => {
  const tabsRef = useRef<HTMLDivElement>(null);
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

  // Keep the active tab visible when the tab row is scrolled (e.g. navigating from a dashboard shortcut on mobile)
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeTab]);

  const handleSaveBalance = () => {
    const parsed = parseFloat(tempBalance);
    if (!isNaN(parsed) && parsed > 0) {
      onUpdateBalance(parsed);
    }
    setIsEditingBalance(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-surface-alt/95 backdrop-blur-xl border-b border-line">
      {/* Row 1: brand + account actions */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-2">
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          aria-label="TradePulse - go to dashboard"
          className="flex items-center gap-2 cursor-pointer group select-none shrink-0 text-left"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-brand-solid via-brand-solid-2 to-accent flex items-center justify-center shadow-md shadow-brand-solid/20 group-hover:scale-105 transition">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-extrabold text-ink tracking-tight">Trade</span>
              <span className="text-sm sm:text-base font-extrabold text-brand tracking-tight">Pulse</span>
            </div>
            <span className="text-[9px] sm:text-[10px] text-faint uppercase tracking-widest font-mono block -mt-1 font-semibold">
              PRO JOURNAL
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          {/* Paper balance */}
          <div className="bg-surface border border-line-strong px-2.5 sm:px-3 py-1.5 rounded-xl hidden sm:flex items-center gap-2 font-mono text-xs shadow-xs">
            <button
              type="button"
              onClick={onOpenDepositModal}
              className="flex items-center gap-1.5 text-ink hover:text-brand font-bold transition cursor-pointer"
              title="Deposit or withdraw simulated paper capital"
            >
              <Wallet className="w-3.5 h-3.5 text-faint" />
              <span>${accountBalance.toLocaleString()}</span>
            </button>
            {onOpenDepositModal && (
              <button
                type="button"
                onClick={onOpenDepositModal}
                className="px-1.5 py-0.5 text-[10px] bg-sunken hover:bg-sunken-strong text-brand rounded font-bold border border-line-brand transition cursor-pointer"
                title="Deposit / Withdraw Paper Funds"
              >
                + Cash
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenChecklistModal}
            aria-label="Open pre-trade checklist"
            className="p-1.5 sm:p-2 text-muted hover:text-ink bg-surface hover:bg-sunken-strong rounded-xl border border-line-strong transition hidden md:flex items-center shadow-xs cursor-pointer"
            title="Pre-trade checklist"
          >
            <ShieldCheck className="w-4 h-4 text-profit" />
          </button>

          {trades.length === 0 && onLoadDemoTrades ? (
            <button
              type="button"
              onClick={onLoadDemoTrades}
              className="px-2.5 py-1.5 text-[11px] font-bold text-brand bg-sunken hover:bg-sunken-strong border border-line-brand rounded-xl transition shadow-xs hidden lg:flex items-center gap-1 cursor-pointer"
              title="Load demo sample trades"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Load Demo Data</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onResetData}
              aria-label={trades.length > 0 ? 'Clear all trades from journal' : 'Reset sample trades'}
              className="p-1.5 sm:p-2 text-faint hover:text-loss bg-surface hover:bg-loss-bg rounded-xl border border-line-strong transition shadow-xs cursor-pointer"
              title={trades.length > 0 ? 'Clear all trades from journal' : 'Reset sample trades'}
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}

          <ThemeToggle />

          <UserMenu
            user={user}
            onOpenAuth={onOpenAuth}
            onSignOut={onSignOut}
            onSyncCloud={onSyncCloud}
            isSyncing={isSyncing}
            trades={trades}
          />

          <PWAInstallButton compact={true} />

          <button
            type="button"
            onClick={onOpenTradeModal}
            className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-brand-solid hover:bg-brand-solid-hover text-white text-xs font-bold rounded-xl flex items-center gap-1 sm:gap-1.5 transition shadow-sm active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>Log Trade</span>
          </button>
        </div>
      </div>

      {/* Row 2: tabs. Always labelled, scrolls sideways on small screens, never wraps or clips. */}
      <nav aria-label="Main" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div
          ref={tabsRef}
          className="flex items-center gap-1 overflow-x-auto no-scrollbar -mb-px [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] md:[mask-image:none]"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3 sm:px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer ${
                  isActive
                    ? 'text-brand border-brand'
                    : 'text-muted border-transparent hover:text-ink hover:border-line-strong'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand' : 'text-faint'}`} />
                <span>{item.label}</span>
                {item.hasBadge && newsBadgeCount > 0 && (
                  <span
                    className="min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-bold font-mono leading-none flex items-center justify-center shrink-0"
                    aria-label={`${newsBadgeCount} unread news headlines`}
                  >
                    {newsBadgeCount > 9 ? '9+' : newsBadgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
