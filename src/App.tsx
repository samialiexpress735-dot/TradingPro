/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trade, Strategy, AssetClass, CapitalTransaction } from './types/trade';
import { INITIAL_STRATEGIES, SAMPLE_DEMO_TRADES } from './data/mockTrades';
import { calculateStats, generateEquityCurve, classifyOutcome } from './utils/calculations';
import {
  supabase,
  isSupabaseConfigured,
  getStoredUserSession,
  signOutUser,
  fetchUserTradesDetailed,
  deleteUserTradeFromCloud,
  batchSyncUserTrades,
  fetchUserStrategies,
  upsertUserStrategy,
  deleteUserStrategyFromCloud,
  fetchUserSettings,
  saveUserSettings,
  UserSettings,
} from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TradeJournal } from './components/TradeJournal';
import { RiskCalculator } from './components/RiskCalculator';
import { StrategyPlaybook } from './components/StrategyPlaybook';
import { AnalyticsView } from './components/AnalyticsView';
import { MarketNewsView } from './components/MarketNewsView';
import { MarketPulseBar } from './components/MarketPulseBar';
import { DailyReviewView } from './components/DailyReviewView';
import { TradeModal } from './components/TradeModal';
import { PreTradeChecklistModal } from './components/PreTradeChecklistModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthModal } from './components/AuthModal';
import { BinanceSyncModal } from './components/BinanceSyncModal';
import { DepositWithdrawModal } from './components/DepositWithdrawModal';
import { DailyLossLimitBanner } from './components/DailyLossLimitCard';
import { useDailyLossLimit } from './hooks/useDailyLossLimit';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useNewsBadge } from './hooks/useNewsBadge';
import { ToastHost, ToastMessage } from './components/Toast';
import {
  loadCachedTrades,
  saveCachedTrades,
  hasCachedTrades,
  getPending,
  markUnsynced,
  markSynced,
  markDeleted,
  clearDeleted,
  newTradeId,
} from './utils/tradeStore';

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news'
  >('dashboard');
  const newsBadgeCount = useNewsBadge(activeTab === 'news');
  const [journalMistakeFilter, setJournalMistakeFilter] = useState<string>('all');

  // Supabase / Multi-device Auth & Cloud Sync state
  const [user, setUser] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isBinanceModalOpen, setIsBinanceModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isConfigured = isSupabaseConfigured();

  // Account starting capital (stored in Supabase public.user_settings)
  const [startingBalance, setStartingBalance] = useState<number>(25000);

  // Trades state (stored in Supabase public.trades)
  // Trades are cached in localStorage on every change, so a refresh always restores the latest state.
  const [rawTrades, setTrades] = useState<Trade[]>(() =>
    loadCachedTrades(getStoredUserSession()?.id || 'guest')
  );
  const tradesRef = useRef<Trade[]>(rawTrades);
  const userKeyRef = useRef<string>('guest');
  const syncInFlightRef = useRef<string | null>(null);
  const pendingDeletesRef = useRef<Map<string, Promise<unknown>>>(new Map());
  const [highlightTradeId, setHighlightTradeId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  } | null>(null);
  const notify = useCallback(
    (kind: ToastMessage['kind'], text: string, actionLabel?: string, onAction?: () => void) =>
      setToast({ id: Date.now(), kind, text, actionLabel, onAction }),
    []
  );
  // Re-derive win/loss/breakeven for closed trades from their P&L. Older imports stored small
  // results (within +/-$2) as breakeven, which hid them from win rate, heatmap counts and streaks.
  const trades = useMemo(
    () =>
      rawTrades.map((t) => {
        if (t.status !== 'closed') return t;
        const outcome = classifyOutcome(t.netPnl || 0);
        return t.outcome === outcome ? t : { ...t, outcome };
      }),
    [rawTrades]
  );

  // Keep the cache key in step with whoever is signed in
  userKeyRef.current = user?.id || 'guest';

  // Strategies state (stored in Supabase public.strategies)
  const [strategies, setStrategies] = useState<Strategy[]>(INITIAL_STRATEGIES);

  // Monthly P&L Target Tracker state (stored in Supabase public.user_settings)
  const [monthlyTargetAmount, setMonthlyTargetAmount] = useState<number>(2500);
  const [monthlyTargetType, setMonthlyTargetType] = useState<'dollar' | 'percent'>('dollar');
  const [binanceApiKey, setBinanceApiKey] = useState<string>('');

  // Modals state
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Partial<Trade> | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [capitalTransactions, setCapitalTransactions] = useState<CapitalTransaction[]>([]);

  // Google Site Verification & AdSense Monetization state
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [googleSiteVerification, setGoogleSiteVerification] = useState<string>('5mo-v_3ysJIX1CEAvNmxD9xaAkMawkK9nwMQ-2O0p2o');
  const [adSensePublisherId, setAdSensePublisherId] = useState<string>('pub-1549023438906458');
  const [adSenseSlotId, setAdSenseSlotId] = useState<string>('');
  const [adSenseAutoAds, setAdSenseAutoAds] = useState<boolean>(true);
  const [adSenseEnabled, setAdSenseEnabled] = useState<boolean>(true);

  // Helper to dynamically inject Google Search Console verification meta tag & AdSense script
  const applyMonetizationToDOM = (settings: Partial<UserSettings>) => {
    if (typeof document === 'undefined') return;
    if (settings.googleSiteVerification !== undefined) {
      let meta = document.querySelector('meta[name="google-site-verification"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'google-site-verification');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', settings.googleSiteVerification);
    }
    if (settings.adSenseEnabled && settings.adSensePublisherId) {
      let pub = settings.adSensePublisherId.trim();
      if (!pub.startsWith('ca-')) pub = `ca-${pub}`;
      const scriptId = 'google-adsense-script';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.crossOrigin = 'anonymous';
        document.head.appendChild(script);
      }
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}`;
    }
  };

  // Load and apply all user settings
  const applyLoadedUserSettings = useCallback((settings: UserSettings) => {
    setUserSettings(settings);
    if (settings.startingBalance !== undefined && settings.startingBalance !== null) {
      setStartingBalance(settings.startingBalance);
    }
    if (settings.monthlyTargetAmount !== undefined && settings.monthlyTargetAmount !== null) {
      setMonthlyTargetAmount(settings.monthlyTargetAmount);
    }
    if (settings.monthlyTargetType) {
      setMonthlyTargetType(settings.monthlyTargetType);
    }
    if (settings.binanceApiKey) {
      setBinanceApiKey(settings.binanceApiKey);
    }
    if (settings.capitalTransactions && Array.isArray(settings.capitalTransactions)) {
      setCapitalTransactions(settings.capitalTransactions);
    }
    if (settings.googleSiteVerification !== undefined) {
      setGoogleSiteVerification(settings.googleSiteVerification);
    }
    if (settings.adSensePublisherId !== undefined) {
      setAdSensePublisherId(settings.adSensePublisherId);
    }
    if (settings.adSenseSlotId !== undefined) {
      setAdSenseSlotId(settings.adSenseSlotId);
    }
    if (settings.adSenseAutoAds !== undefined) {
      setAdSenseAutoAds(settings.adSenseAutoAds);
    }
    if (settings.adSenseEnabled !== undefined) {
      setAdSenseEnabled(settings.adSenseEnabled);
    }
    applyMonetizationToDOM(settings);
  }, []);

  // Single place that changes the trade list: updates state, the ref and the local cache together,
  // so nothing can be lost on refresh even if the cloud is slow or unreachable.
  const commitTrades = useCallback((next: Trade[], key?: string) => {
    tradesRef.current = next;
    setTrades(next);
    saveCachedTrades(key ?? userKeyRef.current, next);
  }, []);

  // Save trades to the cloud. Anything not confirmed stays flagged and is retried on the next load.
  const persistTrades = useCallback(
    async (toSave: Trade[]) => {
      const key = userKeyRef.current;
      if (key === 'guest' || toSave.length === 0) return;
      const ids = toSave.map((t) => t.id);
      markUnsynced(key, ids);
      const ok = await batchSyncUserTrades(key, toSave);
      if (ok) {
        markSynced(key, ids);
      } else {
        notify('error', 'Saved on this device, but cloud sync failed. It will retry automatically.');
      }
    },
    [notify]
  );

  // Delete trades from the cloud. Unconfirmed deletes stay hidden and are retried on the next load.
  const removeTradesFromCloud = useCallback(
    async (ids: string[]) => {
      const key = userKeyRef.current;
      if (key === 'guest' || ids.length === 0) return;
      markDeleted(key, ids);
      const job = Promise.all(ids.map((id) => deleteUserTradeFromCloud(key, id))).then((results) => {
        const done = ids.filter((_, i) => results[i]);
        if (done.length) clearDeleted(key, done);
        if (done.length < ids.length) {
          notify('error', 'Deleted on this device, but the cloud delete failed. It will retry automatically.');
        }
      });
      ids.forEach((id) => pendingDeletesRef.current.set(id, job));
      await job;
      ids.forEach((id) => {
        if (pendingDeletesRef.current.get(id) === job) pendingDeletesRef.current.delete(id);
      });
    },
    [notify]
  );

  // Sync state with Supabase Cloud Database when user logs in
  const syncWithCloud = useCallback(
    async (currentUser: any) => {
      const uid: string | undefined = currentUser?.id;
      if (!uid) return;
      if (syncInFlightRef.current === uid) return; // already syncing this account
      syncInFlightRef.current = uid;
      userKeyRef.current = uid;
      setIsSyncing(true);
      try {
        // 0. Show this account's locally cached trades right away
        const hadCache = hasCachedTrades(uid);
        const cachedNow = loadCachedTrades(uid);
        if (hadCache) {
          tradesRef.current = cachedNow;
          setTrades(cachedNow);
        }
        const guestTrades = tradesRef.current; // trades logged before signing in (first login only)

        // 1. Fetch cloud trades for this user
        const cloud = await fetchUserTradesDetailed(uid);
        if (userKeyRef.current !== uid) return; // signed out / switched account while waiting

        if (cloud.reliable) {
          // Read local state AFTER the await so edits made while fetching are not lost
          const { unsynced, deleted } = getPending(uid);
          const local = loadCachedTrades(uid);
          const localById = new Map(local.map((t) => [t.id, t]));

          // Retry deletes the cloud never confirmed, and hide those trades meanwhile
          if (deleted.size > 0) {
            const ids = [...deleted];
            const results = await Promise.all(ids.map((id) => deleteUserTradeFromCloud(uid, id)));
            const done = ids.filter((_, i) => results[i]);
            if (done.length) clearDeleted(uid, done);
          }

          const merged = new Map<string, Trade>();
          cloud.trades.forEach((t) => {
            if (!deleted.has(t.id)) merged.set(t.id, t);
          });

          // Trades saved here but never confirmed in the cloud: keep the local copy and push it again
          const toPush: Trade[] = [];
          unsynced.forEach((id) => {
            const t = localById.get(id);
            if (t && !deleted.has(id)) {
              merged.set(id, t);
              toPush.push(t);
            }
          });

          // First login on this device: move trades logged as a guest into the account
          if (merged.size === 0 && !hadCache && guestTrades.length > 0) {
            guestTrades.forEach((t) => {
              merged.set(t.id, t);
              toPush.push(t);
            });
            saveCachedTrades('guest', []);
          }

          const next = [...merged.values()].sort((a, b) =>
            `${b.date} ${b.time || ''}`.localeCompare(`${a.date} ${a.time || ''}`)
          );
          commitTrades(next, uid);

          if (toPush.length > 0) {
            const ok = await batchSyncUserTrades(uid, toPush);
            if (ok) markSynced(uid, toPush.map((t) => t.id));
          }
        }
        // If the cloud was unreachable we keep showing the cached trades instead of wiping them.

        // 2. Fetch cloud strategies for this user from Supabase
        const cloudStrategies = await fetchUserStrategies(uid);
        if (cloudStrategies && cloudStrategies.length > 0) {
          setStrategies(cloudStrategies);
        }

        // 3. Fetch user settings (balance, monthly target, binance api key, capital adjustments, monetization) from Supabase
        const settings = await fetchUserSettings(uid);
        if (settings) {
          applyLoadedUserSettings(settings);
        }
      } catch (err) {
        console.error('Error synchronizing with Supabase:', err);
      } finally {
        if (syncInFlightRef.current === uid) syncInFlightRef.current = null;
        setIsSyncing(false);
      }
    },
    // NOTE: deliberately does not depend on `trades` - doing so re-ran the sync after every edit
    // and let stale cloud data overwrite fresh deletes / clones.
    [applyLoadedUserSettings, commitTrades]
  );

  // Manual sync triggered from UserMenu
  const handleManualSync = async () => {
    if (user) {
      await syncWithCloud(user);
    }
  };

  // Restore authenticated session on initial load (across reloads and mobile sessions)
  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        const currentUser = session?.user ?? null;
        if (currentUser) {
          setUser(currentUser);
          syncWithCloud(currentUser);
        } else {
          const stored = getStoredUserSession();
          if (stored) {
            setUser(stored);
            syncWithCloud(stored);
          } else {
            fetchUserSettings('default_guest').then((settings) => {
              if (settings) {
                applyLoadedUserSettings(settings);
              }
            });
          }
        }
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (event === 'SIGNED_IN' && currentUser) {
          syncWithCloud(currentUser);
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      const stored = getStoredUserSession();
      if (stored) {
        setUser(stored);
        syncWithCloud(stored);
      } else {
        fetchUserSettings('default_guest').then((settings) => {
          if (settings) {
            applyLoadedUserSettings(settings);
          }
        });
      }
    }
  }, [syncWithCloud, applyLoadedUserSettings]);

  // Derived calculations
  const performanceStats = useMemo(() => calculateStats(trades), [trades]);
  const equityCurveData = useMemo(
    () => generateEquityCurve(trades, startingBalance),
    [trades, startingBalance]
  );

  // Account balance = deposited capital (startingBalance) + realized P&L of closed trades.
  // startingBalance only changes through deposits/withdrawals; trades move the balance via P&L.
  const realizedPnl = useMemo(
    () =>
      Number(
        trades
          .filter((t) => t.status === 'closed')
          .reduce((sum, t) => sum + (t.netPnl || 0), 0)
          .toFixed(2)
      ),
    [trades]
  );
  const accountBalance = Number((startingBalance + realizedPnl).toFixed(2));

  // Daily loss limit (tracks today's realized loss against a user-set cap)
  const dailyLimit = useDailyLossLimit(trades, accountBalance, user?.id);
  const [dismissedLimitDay, setDismissedLimitDay] = useState<string | null>(null);

  // Capital adjustments (paper deposits and withdrawals)
  // `newBalance` is the new total account balance (including P&L), so strip P&L
  // back out before storing it as the capital base.
  const handleApplyCapitalAdjustment = async (newBalance: number, transaction: CapitalTransaction) => {
    const newStartingBalance = Number((newBalance - realizedPnl).toFixed(2));
    setStartingBalance(newStartingBalance);
    const updatedTxs = [transaction, ...capitalTransactions];
    setCapitalTransactions(updatedTxs);

    const targetUserId = user?.id || 'default_guest';
    await saveUserSettings(targetUserId, {
      startingBalance: newStartingBalance,
      capitalTransactions: updatedTxs,
    });
  };

  const handleDeleteCapitalTransaction = async (txId: string) => {
    const updatedTxs = capitalTransactions.filter((t) => t.id !== txId);
    setCapitalTransactions(updatedTxs);
    const targetUserId = user?.id || 'default_guest';
    await saveUserSettings(targetUserId, {
      startingBalance,
      capitalTransactions: updatedTxs,
    });
  };

  // Trade management handlers
  const flashTrade = (id: string) => {
    setHighlightTradeId(id);
    setTimeout(() => setHighlightTradeId((cur) => (cur === id ? null : cur)), 3000);
  };

  const handleSaveTrade = async (tradeToSave: Trade) => {
    const prev = tradesRef.current;
    const exists = prev.some((t) => t.id === tradeToSave.id);
    commitTrades(
      exists ? prev.map((t) => (t.id === tradeToSave.id ? tradeToSave : t)) : [tradeToSave, ...prev]
    );
    setEditingTrade(null);
    flashTrade(tradeToSave.id);
    await persistTrades([tradeToSave]);
  };

  const handleRestoreTrade = async (trade: Trade) => {
    // Let any in-flight cloud delete finish first, otherwise it could land after the restore
    await pendingDeletesRef.current.get(trade.id);
    commitTrades([trade, ...tradesRef.current.filter((t) => t.id !== trade.id)]);
    flashTrade(trade.id);
    await persistTrades([trade]);
  };

  const handleDeleteTrade = async (id: string) => {
    const removed = tradesRef.current.find((t) => t.id === id);
    if (!removed) return;
    commitTrades(tradesRef.current.filter((t) => t.id !== id));
    notify('success', `Deleted ${removed.symbol} trade`, 'Undo', () => {
      void handleRestoreTrade(removed);
    });
    await removeTradesFromCloud([id]);
  };

  const handleDuplicateTrade = async (trade: Trade) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const clone: Trade = {
      ...trade,
      id: newTradeId(),
      date,
      time,
      exitDate: trade.status === 'closed' ? date : trade.exitDate,
      exitTime: trade.status === 'closed' ? time : trade.exitTime,
    };
    commitTrades([clone, ...tradesRef.current]);
    flashTrade(clone.id);
    notify('success', `Duplicated ${trade.symbol} trade`, 'Edit', () => {
      setEditingTrade(clone);
      setIsTradeModalOpen(true);
    });
    await persistTrades([clone]);
  };

  const handleAddTradeClick = () => {
    setEditingTrade(null);
    setIsTradeModalOpen(true);
  };

  const handleEditTradeClick = (trade: Trade) => {
    setEditingTrade(trade);
    setIsTradeModalOpen(true);
  };

  // Merge newly imported trades (skipping ids that already exist) and save them
  const addImportedTrades = async (imported: Trade[]) => {
    const existing = new Set(tradesRef.current.map((t) => t.id));
    const fresh = imported.filter((t) => !existing.has(t.id));
    if (fresh.length === 0) return;
    commitTrades([...fresh, ...tradesRef.current]);
    await persistTrades(fresh);
  };

  // CSV Import handler
  const handleImportCsv = async (importedTrades: Trade[]) => {
    await addImportedTrades(importedTrades);
  };

  // Binance trades import handler (Spot & Futures)
  const handleImportBinanceTrades = async (newTrades: Trade[]) => {
    await addImportedTrades(newTrades);
  };

  // Calculator integration
  const handlePreFillFromCalculator = (calcData: {
    symbol?: string;
    assetClass: AssetClass;
    direction: 'long' | 'short';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    plannedRR?: number;
    fees?: number;
  }) => {
    const initialData: Partial<Trade> = {
      ...calcData,
      symbol: calcData.symbol || 'AAPL',
      id: `tr-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      status: 'open',
      outcome: 'breakeven',
      grossPnl: 0,
      netPnl: 0,
      roi: 0,
      rating: 5,
      emotion: 'Disciplined',
      strategy: strategies[0]?.name || 'Breakout Edge',
    };
    setEditingTrade(initialData);
    setIsTradeModalOpen(true);
  };

  // Load sample demo trades
  const loadDemoTrades = async () => {
    await addImportedTrades(SAMPLE_DEMO_TRADES);
  };

  const handleLoadDemoTrades = () => {
    if (tradesRef.current.length > 0) {
      setConfirmState({
        title: 'Load sample trades?',
        message: 'Existing trades will be kept alongside the sample entries.',
        confirmLabel: 'Load samples',
        onConfirm: () => {
          setConfirmState(null);
          void loadDemoTrades();
        },
      });
      return;
    }
    void loadDemoTrades();
  };

  // Reset or clear data
  const handleResetData = () => {
    setConfirmState({
      title: 'Clear all trades?',
      message: 'Every trade will be removed from your journal and your cloud account. This cannot be undone.',
      confirmLabel: 'Clear everything',
      danger: true,
      onConfirm: () => {
        setConfirmState(null);
        const ids = tradesRef.current.map((t) => t.id);
        commitTrades([]);
        void removeTradesFromCloud(ids);
      },
    });
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    userKeyRef.current = 'guest';
    syncInFlightRef.current = null;
    const guestTrades = loadCachedTrades('guest');
    tradesRef.current = guestTrades;
    setTrades(guestTrades);
  };

  // Strategy management
  const handleAddStrategy = async (newStrat: Strategy) => {
    setStrategies((prev) => [...prev, newStrat]);
    if (user?.id) {
      try {
        await upsertUserStrategy(user.id, newStrat);
      } catch (e) {
        console.error('Error saving strategy:', e);
      }
    }
  };

  const handleUpdateStrategy = async (updatedStrat: Strategy) => {
    setStrategies((prev) => prev.map((s) => (s.id === updatedStrat.id ? updatedStrat : s)));
    if (user?.id) {
      try {
        await upsertUserStrategy(user.id, updatedStrat);
      } catch (e) {
        console.error('Error updating strategy:', e);
      }
    }
  };

  const handleDeleteStrategy = async (id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    if (user?.id) {
      try {
        await deleteUserStrategyFromCloud(user.id, id);
      } catch (e) {
        console.error('Error deleting strategy:', e);
      }
    }
  };

  const handleUpdateBalance = (newBalance: number) => {
    // newBalance is the desired total balance; store the capital base without P&L
    const newStartingBalance = Number((newBalance - realizedPnl).toFixed(2));
    setStartingBalance(newStartingBalance);
    if (user?.id) {
      saveUserSettings(user.id, { startingBalance: newStartingBalance }).catch((e) =>
        console.error('Error saving balance to Supabase:', e)
      );
    }
  };

  // Monthly P&L Target handler
  const handleTargetChange = (type: 'dollar' | 'percent', val: number) => {
    setMonthlyTargetType(type);
    setMonthlyTargetAmount(val);
    if (user?.id) {
      saveUserSettings(user.id, {
        monthlyTargetType: type,
        monthlyTargetAmount: val,
      }).catch((e) => console.error('Failed to save monthly target to Supabase:', e));
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-accent selection:text-white">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        newsBadgeCount={newsBadgeCount}
        onSelectTab={setActiveTab}
        onOpenTradeModal={handleAddTradeClick}
        onOpenChecklistModal={() => setIsChecklistOpen(true)}
        onResetData={handleResetData}
        accountBalance={accountBalance}
        onUpdateBalance={handleUpdateBalance}
        user={user}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onSignOut={handleSignOut}
        onSyncCloud={handleManualSync}
        isSyncing={isSyncing}
        trades={trades}
        onLoadDemoTrades={handleLoadDemoTrades}
        onOpenDepositModal={() => setIsDepositModalOpen(true)}
      />

      {/* Global Market Pulse & Binance Perpetual Ticker Bar */}
      <MarketPulseBar onNavigateToTab={setActiveTab} />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        <DailyLossLimitBanner
          limit={dailyLimit}
          dismissedDay={dismissedLimitDay}
          onDismiss={() => setDismissedLimitDay(dailyLimit.todayKey)}
        />

        {activeTab === 'dashboard' && (
          <Dashboard
            dailyLimit={dailyLimit}
            stats={performanceStats}
            trades={trades}
            equityData={equityCurveData}
            startingBalance={startingBalance}
            userId={user?.id}
            monthlyTargetAmount={monthlyTargetAmount}
            monthlyTargetType={monthlyTargetType}
            onTargetChange={handleTargetChange}
            onAddTrade={handleAddTradeClick}
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onOpenBinanceSync={() => setIsBinanceModalOpen(true)}
            onOpenDepositModal={() => setIsDepositModalOpen(true)}
            onNavigateToTab={setActiveTab}
            onNavigateToJournalWithFilter={(mistake) => {
              setJournalMistakeFilter(mistake);
              setActiveTab('journal');
            }}
            onSelectDate={() => setActiveTab('journal')}
            onLoadDemoTrades={trades.length === 0 ? handleLoadDemoTrades : undefined}
            adSensePublisherId={adSensePublisherId}
            adSenseSlotId={adSenseSlotId}
            adSenseEnabled={adSenseEnabled}
          />
        )}

        {activeTab === 'journal' && (
          <TradeJournal
            trades={trades}
            strategies={strategies}
            onAddTrade={handleAddTradeClick}
            onEditTrade={handleEditTradeClick}
            onDeleteTrade={handleDeleteTrade}
            onDuplicateTrade={handleDuplicateTrade}
            onImportCsv={handleImportCsv}
            highlightTradeId={highlightTradeId}
            onOpenBinanceSync={() => setIsBinanceModalOpen(true)}
            initialFilterMistake={journalMistakeFilter}
          />
        )}

        {activeTab === 'review' && (
          <DailyReviewView
            trades={trades}
            userId={user?.id}
            onNavigateToJournal={(date) => setActiveTab('journal')}
          />
        )}

        {activeTab === 'calculator' && (
          <RiskCalculator
            currentBalance={accountBalance}
            onPreFillTrade={handlePreFillFromCalculator}
          />
        )}

        {activeTab === 'playbook' && (
          <StrategyPlaybook
            strategies={strategies}
            trades={trades}
            onAddStrategy={handleAddStrategy}
            onUpdateStrategy={handleUpdateStrategy}
            onDeleteStrategy={handleDeleteStrategy}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView trades={trades} stats={performanceStats} />
        )}

        {activeTab === 'news' && (
          <MarketNewsView
            trades={trades}
            onNavigateToTab={setActiveTab}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-sunken-strong py-6 px-4 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-ink">TradePulse</span>
            <span>• Quantitative Journal &amp; Edge Analytics</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-profit font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-profit-solid"></span>
              {user ? `Connected: ${user.email} (Real-Time Cloud Synced)` : 'Multi-Device Cloud Ready'}
            </span>
            <span>Local Time: {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </footer>

      {/* Trade Log & Edit Modal */}
      <TradeModal
        isOpen={isTradeModalOpen}
        onClose={() => {
          setIsTradeModalOpen(false);
          setEditingTrade(null);
        }}
        onSave={handleSaveTrade}
        initialTrade={editingTrade}
        isEditing={!!editingTrade?.id && trades.some((t) => t.id === editingTrade.id)}
        strategies={strategies}
      />

      {/* Pre-Trade Discipline Checklist Modal */}
      <PreTradeChecklistModal
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        onProceedToTrade={() => {
          setIsChecklistOpen(false);
          handleAddTradeClick();
        }}
      />

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          setIsAuthModalOpen(false);
          syncWithCloud(newUser);
        }}
      />

      {/* Binance Spot & Futures Sync Modal */}
      <BinanceSyncModal
        isOpen={isBinanceModalOpen}
        onClose={() => setIsBinanceModalOpen(false)}
        onImportTrades={handleImportBinanceTrades}
        existingTrades={trades}
        userId={user?.id}
        initialApiKey={binanceApiKey}
      />

      {/* Simulated Deposit & Withdrawal Modal */}
      <DepositWithdrawModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        currentBalance={accountBalance}
        onApplyAdjustment={handleApplyCapitalAdjustment}
        transactions={capitalTransactions}
        onDeleteTransaction={handleDeleteCapitalTransaction}
      />

      {/* PWA Offline Network Toast */}
      <OfflineIndicator />

      {/* Confirm dialog (replaces blocked-prone window.confirm) */}
      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        danger={confirmState?.danger}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      {/* Action feedback (delete / duplicate / sync problems) */}
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
