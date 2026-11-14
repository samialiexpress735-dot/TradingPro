import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  LayoutDashboard,
  BookOpen,
  Calculator,
  Layers,
  BarChart3,
  Plus,
  ShieldCheck,
  RotateCcw,
  Wallet,
  Radio,
  CalendarCheck,
  ChevronDown,
  Menu,
  X,
  MoreHorizontal,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from './ThemeToggle';
import { Trade } from '../types/trade';

export type TabId = 'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news';

interface NavbarProps {
  activeTab: TabId;
  /** Unread headlines in the live news feed (badge is hidden at 0). */
  newsBadgeCount?: number;
  onSelectTab: (tab: TabId) => void;
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

type Icon = React.ComponentType<{ className?: string }>;

interface NavEntry {
  /** A tab to open. Omit for pure actions (e.g. the checklist). */
  id?: TabId;
  action?: 'checklist';
  label: string;
  desc: string;
  icon: Icon;
  hasBadge?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  icon: Icon;
  /** Single-entry groups render as a plain link instead of a dropdown. */
  items: NavEntry[];
}

/**
 * Seven flat tabs became four groups:
 *   Dashboard  - the home screen
 *   Journal    - everything you record (trades, daily routine, setups)
 *   Insights   - everything you learn from it (analytics, market news)
 *   Tools      - things you use before you trade
 */
const NAV_GROUPS: NavGroup[] = [
  {
    key: 'overview',
    label: 'Dashboard',
    icon: LayoutDashboard,
    items: [{ id: 'dashboard', label: 'Dashboard', desc: 'Performance at a glance', icon: LayoutDashboard }],
  },
  {
    key: 'journal',
    label: 'Journal',
    icon: BookOpen,
    items: [
      { id: 'journal', label: 'Trade Journal', desc: 'Every execution, filters and CSV import', icon: BookOpen },
      { id: 'review', label: 'Daily Review', desc: 'Pre-market prep and end-of-day grade', icon: CalendarCheck },
      { id: 'playbook', label: 'Playbook', desc: 'Setups, rules and win rates', icon: Layers },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    icon: BarChart3,
    items: [
      { id: 'analytics', label: 'Analytics', desc: 'Edge, expectancy and breakdowns', icon: BarChart3 },
      { id: 'news', label: 'Market News', desc: 'Live headlines and catalysts', icon: Radio, hasBadge: true },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: Calculator,
    items: [
      { id: 'calculator', label: 'Risk Sizer', desc: 'Position size from risk and stop', icon: Calculator },
      { action: 'checklist', label: 'Pre-trade Checklist', desc: 'Run your rules before you enter', icon: ShieldCheck },
    ],
  },
];

const Badge: React.FC<{ count: number }> = ({ count }) => (
  <span
    className="min-w-4 h-4 px-1 rounded-full bg-accent text-canvas text-[10px] font-bold font-mono leading-none flex items-center justify-center shrink-0"
    aria-label={`${count} unread news headlines`}
  >
    {count > 9 ? '9+' : count}
  </span>
);

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  newsBadgeCount = 0,
  onSelectTab,
  onOpenTradeModal,
  onOpenChecklistModal,
  onResetData,
  accountBalance,
  user,
  onOpenAuth,
  onSignOut,
  onSyncCloud,
  isSyncing,
  trades,
  onLoadDemoTrades,
  onOpenDepositModal,
}) => {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const barRef = useRef<HTMLElement>(null);

  const closeAll = useCallback(() => {
    setOpenMenu(null);
    setMobileOpen(false);
  }, []);

  // Close menus on outside click / Escape
  useEffect(() => {
    if (!openMenu && !mobileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenu, mobileOpen, closeAll]);

  const runEntry = (entry: NavEntry) => {
    closeAll();
    if (entry.action === 'checklist') onOpenChecklistModal();
    else if (entry.id) onSelectTab(entry.id);
  };

  const groupIsActive = (g: NavGroup) => g.items.some((i) => i.id === activeTab);
  const hasData = trades.length > 0;

  const triggerClass = (active: boolean, open: boolean) =>
    `relative h-9 px-3 rounded-lg flex items-center gap-1.5 text-[13px] font-semibold transition cursor-pointer select-none ${
      active
        ? 'text-brand bg-brand-solid/10'
        : open
          ? 'text-ink bg-sunken'
          : 'text-muted hover:text-ink hover:bg-sunken'
    }`;

  return (
    <header
      ref={barRef}
      className="sticky top-0 z-40 bg-surface/85 backdrop-blur-xl border-b border-line"
    >
      <div className="max-w-[1440px] mx-auto h-14 sm:h-16 px-3 sm:px-6 lg:px-8 flex items-center gap-3 lg:gap-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => {
            closeAll();
            onSelectTab('dashboard');
          }}
          aria-label="TradePulse - go to dashboard"
          className="flex items-center gap-2.5 cursor-pointer group select-none shrink-0 text-left"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-brand-solid to-brand-solid-2 flex items-center justify-center shadow-md shadow-brand-solid/30 group-hover:scale-105 transition">
            <TrendingUp className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white stroke-[2.5]" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] sm:text-base font-extrabold text-ink tracking-tight">
              Trade<span className="text-brand">Pulse</span>
            </div>
            <div className="hidden sm:block text-[9px] text-faint uppercase tracking-[0.18em] font-mono font-semibold mt-1">
              Pro Journal
            </div>
          </div>
        </button>

        {/* Desktop navigation (grouped) */}
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 flex-1 min-w-0">
          {NAV_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const active = groupIsActive(group);
            const isSingle = group.items.length === 1;
            const open = openMenu === group.key;
            const showDot = group.key === 'insights' && newsBadgeCount > 0;

            if (isSingle) {
              const entry = group.items[0];
              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => runEntry(entry)}
                  onMouseEnter={() => openMenu && setOpenMenu(null)}
                  aria-current={active ? 'page' : undefined}
                  className={triggerClass(active, false)}
                >
                  <GroupIcon className="w-4 h-4 shrink-0" />
                  <span>{group.label}</span>
                </button>
              );
            }

            return (
              <div
                key={group.key}
                className="relative"
                onMouseEnter={() => openMenu && openMenu !== group.key && setOpenMenu(group.key)}
              >
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={open}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setOpenMenu(open ? null : group.key)}
                  className={triggerClass(active, open)}
                >
                  <GroupIcon className="w-4 h-4 shrink-0" />
                  <span>{group.label}</span>
                  <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
                  {showDot && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent ring-2 ring-surface" aria-label="New headlines" />
                  )}
                </button>

                {open && (
                  <div
                    role="menu"
                    aria-label={group.label}
                    className="absolute left-0 top-full mt-2 w-72 p-1.5 bg-surface border border-line-strong rounded-2xl shadow-lg animate-pop-in z-50"
                  >
                    {group.items.map((entry) => {
                      const EntryIcon = entry.icon;
                      const isActive = entry.id === activeTab;
                      return (
                        <button
                          key={entry.label}
                          type="button"
                          role="menuitem"
                          onClick={() => runEntry(entry)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                            isActive ? 'bg-brand-solid/10' : 'hover:bg-sunken'
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isActive ? 'bg-brand-solid text-white' : 'bg-sunken text-brand'
                            }`}
                          >
                            <EntryIcon className="w-4 h-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                              {entry.label}
                              {entry.hasBadge && newsBadgeCount > 0 && <Badge count={newsBadgeCount} />}
                            </span>
                            <span className="block text-[11.5px] text-muted leading-snug mt-0.5">{entry.desc}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="flex-1 lg:hidden" />

        {/* Right cluster */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenDepositModal && (
            <button
              type="button"
              onClick={onOpenDepositModal}
              title="Deposit or withdraw paper capital"
              className="hidden md:flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-lg bg-sunken hover:bg-sunken-strong border border-line transition cursor-pointer font-mono text-xs font-semibold text-ink"
            >
              <Wallet className="w-3.5 h-3.5 text-faint" />
              <span>${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              closeAll();
              onOpenTradeModal();
            }}
            className="h-9 px-3 sm:px-4 bg-brand-solid hover:bg-brand-solid-hover text-white text-[13px] font-bold rounded-lg flex items-center gap-1.5 transition shadow-sm shadow-brand-solid/25 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Log Trade</span>
          </button>

          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle />
            <PWAInstallButton compact={true} />
          </div>

          <UserMenu
            user={user}
            onOpenAuth={onOpenAuth}
            onSignOut={onSignOut}
            onSyncCloud={onSyncCloud}
            isSyncing={isSyncing}
            trades={trades}
          />

          {/* More: rarely used, destructive actions live here instead of the main bar */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={openMenu === 'more'}
              aria-label="More actions"
              onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}
              className={`h-9 w-9 rounded-lg flex items-center justify-center border border-line transition cursor-pointer ${
                openMenu === 'more' ? 'bg-sunken text-ink' : 'text-faint hover:text-ink hover:bg-sunken'
              }`}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {openMenu === 'more' && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 p-1.5 bg-surface border border-line-strong rounded-2xl shadow-lg animate-pop-in z-50"
              >
                {!hasData && onLoadDemoTrades && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAll();
                      onLoadDemoTrades();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-ink hover:bg-sunken transition cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-brand" />
                    Load demo data
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeAll();
                    onResetData();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium text-loss hover:bg-loss-bg transition cursor-pointer"
                >
                  {hasData ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  {hasData ? 'Clear all trades' : 'Reset sample trades'}
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => {
              setOpenMenu(null);
              setMobileOpen((v) => !v);
            }}
            className="lg:hidden h-9 w-9 rounded-lg flex items-center justify-center border border-line text-ink hover:bg-sunken transition cursor-pointer"
          >
            {mobileOpen ? <X className="w-4.5 h-4.5" /> : <Menu className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet panel */}
      {mobileOpen && (
        <nav
          aria-label="Main"
          className="lg:hidden absolute inset-x-0 top-full border-t border-line bg-surface shadow-lg animate-fade-in max-h-[calc(100dvh-3.5rem)] overflow-y-auto"
        >
          <div className="px-3 sm:px-6 py-3 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.key}>
                {group.items.length > 1 && (
                  <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((entry) => {
                    const EntryIcon = entry.icon;
                    const isActive = entry.id === activeTab;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        onClick={() => runEntry(entry)}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition cursor-pointer ${
                          isActive ? 'bg-brand-solid/10 text-brand' : 'text-ink hover:bg-sunken'
                        }`}
                      >
                        <EntryIcon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-brand' : 'text-faint'}`} />
                        <span className="flex-1 text-sm font-semibold">{entry.label}</span>
                        {entry.hasBadge && newsBadgeCount > 0 && <Badge count={newsBadgeCount} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-3 border-t border-line-soft grid grid-cols-2 gap-2">
              {onOpenDepositModal && (
                <button
                  type="button"
                  onClick={() => {
                    closeAll();
                    onOpenDepositModal();
                  }}
                  className="col-span-2 flex items-center justify-between px-3 py-2.5 rounded-xl bg-sunken border border-line text-sm font-semibold text-ink cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-faint" /> Paper balance
                  </span>
                  <span className="font-mono">${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <PWAInstallButton compact={true} />
              </div>
              <button
                type="button"
                onClick={() => {
                  closeAll();
                  if (!hasData && onLoadDemoTrades) onLoadDemoTrades();
                  else onResetData();
                }}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                  !hasData && onLoadDemoTrades
                    ? 'border-line-brand text-brand bg-sunken'
                    : 'border-loss-line text-loss bg-loss-bg-soft'
                }`}
              >
                {!hasData && onLoadDemoTrades ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Load demo
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" /> Clear trades
                  </>
                )}
              </button>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
};
