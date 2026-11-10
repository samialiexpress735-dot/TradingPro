/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trade, Strategy, AssetClass, CapitalTransaction } from './types/trade';
import { INITIAL_TRADES, INITIAL_STRATEGIES, SAMPLE_DEMO_TRADES } from './data/mockTrades';
import { calculateStats, generateEquityCurve } from './utils/calculations';
import {
  supabase,
  isSupabaseConfigured,
  getStoredUserSession,
  signOutUser,
  fetchUserTrades,
  upsertUserTrade,
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

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'news'
  >('dashboard');
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
  const [trades, setTrades] = useState<Trade[]>(INITIAL_TRADES);

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

  // Sync state with Supabase Cloud Database when user logs in
  const syncWithCloud = useCallback(
    async (currentUser: any) => {
      if (!currentUser?.id) return;
      setIsSyncing(true);
      try {
        // 1. Fetch cloud trades for this user from Supabase
        const cloudTrades = await fetchUserTrades(currentUser.id);

        if (cloudTrades && cloudTrades.length > 0) {
          // Cloud has data for this user account: use it as source of truth
          setTrades(cloudTrades);
        } else if (trades.length > 0) {
          // Push initial in-memory trades to cloud
          await batchSyncUserTrades(currentUser.id, trades);
        }

        // 2. Fetch cloud strategies for this user from Supabase
        const cloudStrategies = await fetchUserStrategies(currentUser.id);
        if (cloudStrategies && cloudStrategies.length > 0) {
          setStrategies(cloudStrategies);
        }

        // 3. Fetch user settings (balance, monthly target, binance api key, capital adjustments, monetization) from Supabase
        const settings = await fetchUserSettings(currentUser.id);
        if (settings) {
          applyLoadedUserSettings(settings);
        }
      } catch (err) {
        console.error('Error synchronizing with Supabase:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [trades, applyLoadedUserSettings]
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

  // Background server sync for trades
  useEffect(() => {
    if (user?.id) {
      fetch('/api/user/trades/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, trades }),
      }).catch(() => {});
    }
  }, [trades, user?.id]);

  // Derived calculations
  const performanceStats = useMemo(() => calculateStats(trades), [trades]);
  const equityCurveData = useMemo(
    () => generateEquityCurve(trades, startingBalance),
    [trades, startingBalance]
  );

  // Capital adjustments (paper deposits and withdrawals)
  const handleApplyCapitalAdjustment = async (newBalance: number, transaction: CapitalTransaction) => {
    setStartingBalance(newBalance);
    const updatedTxs = [transaction, ...capitalTransactions];
    setCapitalTransactions(updatedTxs);

    const targetUserId = user?.id || 'default_guest';
    await saveUserSettings(targetUserId, {
      startingBalance: newBalance,
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
  const handleSaveTrade = async (tradeToSave: Trade) => {
    setTrades((prev) => {
      const existsIndex = prev.findIndex((t) => t.id === tradeToSave.id);
      if (existsIndex >= 0) {
        const updated = [...prev];
        updated[existsIndex] = tradeToSave;
        return updated;
      }
      return [tradeToSave, ...prev];
    });
    setEditingTrade(null);

    // Save to user account cloud/server database immediately
    if (user?.id) {
      try {
        await upsertUserTrade(user.id, tradeToSave);
      } catch (err) {
        console.error('Failed to sync saved trade to Supabase:', err);
      }
    }
  };

  const handleDeleteTrade = async (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));

    if (user?.id) {
      try {
        await deleteUserTradeFromCloud(user.id, id);
      } catch (err) {
        console.error('Failed to delete trade from Supabase:', err);
      }
    }
  };

  const handleDuplicateTrade = (trade: Trade) => {
    const duplicated: Trade = {
      ...trade,
      id: `tr-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    };
    setEditingTrade(duplicated);
    setIsTradeModalOpen(true);
  };

  const handleAddTradeClick = () => {
    setEditingTrade(null);
    setIsTradeModalOpen(true);
  };

  const handleEditTradeClick = (trade: Trade) => {
    setEditingTrade(trade);
    setIsTradeModalOpen(true);
  };

  // CSV Import handler
  const handleImportCsv = async (importedTrades: Trade[]) => {
    setTrades((prev) => [...importedTrades, ...prev]);
    if (user?.id) {
      try {
        await batchSyncUserTrades(user.id, [...importedTrades, ...trades]);
      } catch (err) {
        console.error('Failed to sync imported trades to Supabase:', err);
      }
    }
  };

  // Binance trades import handler (Spot & Futures)
  const handleImportBinanceTrades = async (newTrades: Trade[]) => {
    if (newTrades.length === 0) return;
    const updated = [...newTrades, ...trades];
    setTrades(updated);
    if (user?.id) {
      try {
        await batchSyncUserTrades(user.id, updated);
      } catch (err) {
        console.error('Failed to sync imported Binance trades to Supabase:', err);
      }
    }
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
  const handleLoadDemoTrades = () => {
    if (trades.length > 0) {
      if (!window.confirm('Load sample trades? Existing trades will be preserved alongside sample entries.')) {
        return;
      }
    }
    setTrades(SAMPLE_DEMO_TRADES);
    if (user?.id) {
      batchSyncUserTrades(user.id, SAMPLE_DEMO_TRADES).catch(() => {});
    }
  };

  // Reset or clear data
  const handleResetData = () => {
    if (window.confirm('Clear all trades from your journal to start completely fresh?')) {
      setTrades([]);
      if (user?.id) {
        batchSyncUserTrades(user.id, []).catch(() => {});
      }
    }
  };

  // Sign out handler
  const handleSignOut = async () => {
    await signOutUser();
    setUser(null);
    setTrades([]);
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
    setStartingBalance(newBalance);
    if (user?.id) {
      saveUserSettings(user.id, { startingBalance: newBalance }).catch((e) =>
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
        onSelectTab={setActiveTab}
        onOpenTradeModal={handleAddTradeClick}
        onOpenChecklistModal={() => setIsChecklistOpen(true)}
        onResetData={handleResetData}
        accountBalance={startingBalance}
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
        {activeTab === 'dashboard' && (
          <Dashboard
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
            currentBalance={startingBalance}
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
        currentBalance={startingBalance}
        onApplyAdjustment={handleApplyCapitalAdjustment}
        transactions={capitalTransactions}
        onDeleteTransaction={handleDeleteCapitalTransaction}
      />

      {/* PWA Offline Network Toast */}
      <OfflineIndicator />
    </div>
  );
}
