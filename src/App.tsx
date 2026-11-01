/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Trade, Strategy, AssetClass } from './types/trade';
import { INITIAL_TRADES, INITIAL_STRATEGIES, SAMPLE_DEMO_TRADES } from './data/mockTrades';
import { calculateStats, generateEquityCurve } from './utils/calculations';
import {
  supabase,
  isSupabaseConfigured,
  fetchUserTrades,
  upsertUserTrade,
  deleteUserTradeFromCloud,
  batchSyncUserTrades,
  fetchUserStrategies,
  upsertUserStrategy,
  deleteUserStrategyFromCloud,
  fetchUserSettings,
  saveUserSettings,
} from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { TradeJournal } from './components/TradeJournal';
import { RiskCalculator } from './components/RiskCalculator';
import { StrategyPlaybook } from './components/StrategyPlaybook';
import { AnalyticsView } from './components/AnalyticsView';
import { SupportAndApi } from './components/SupportAndApi';
import { DailyReviewView } from './components/DailyReviewView';
import { TradeModal } from './components/TradeModal';
import { PreTradeChecklistModal } from './components/PreTradeChecklistModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AuthModal } from './components/AuthModal';

export default function App() {
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'journal' | 'review' | 'calculator' | 'playbook' | 'analytics' | 'support'
  >('dashboard');

  // Supabase Auth & Cloud Sync state
  const [user, setUser] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const isConfigured = isSupabaseConfigured();

  // One-time cleanup check: if user has previous mock trades stored, clear them for a pristine production start
  useEffect(() => {
    const isCleaned = localStorage.getItem('tradepulse_prod_clean_v2');
    if (!isCleaned) {
      localStorage.removeItem('tradepulse_trades');
      localStorage.setItem('tradepulse_prod_clean_v2', 'true');
    }
  }, []);

  // Account starting capital
  const [startingBalance, setStartingBalance] = useState<number>(() => {
    const saved = localStorage.getItem('tradepulse_balance');
    return saved ? Number(saved) : 25000;
  });

  // Trades state with localStorage persistence (starts empty for production)
  const [trades, setTrades] = useState<Trade[]>(() => {
    const isCleaned = localStorage.getItem('tradepulse_prod_clean_v2');
    if (isCleaned) {
      const saved = localStorage.getItem('tradepulse_trades');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error loading trades from storage:', e);
        }
      }
    }
    return INITIAL_TRADES; // [] in production
  });

  // Strategies state with localStorage persistence
  const [strategies, setStrategies] = useState<Strategy[]>(() => {
    const saved = localStorage.getItem('tradepulse_strategies');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading strategies from storage:', e);
      }
    }
    return INITIAL_STRATEGIES;
  });

  // Modals state
  const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Partial<Trade> | null>(null);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // Sync state to Supabase when user logs in
  const syncWithCloud = useCallback(
    async (currentUser: any) => {
      if (!currentUser || !isConfigured) return;
      setIsSyncing(true);
      try {
        // 1. Fetch cloud trades
        const cloudTrades = await fetchUserTrades(currentUser.id);

        if (cloudTrades && cloudTrades.length > 0) {
          // Cloud has data: use it as source of truth
          setTrades(cloudTrades);
          localStorage.setItem('tradepulse_trades', JSON.stringify(cloudTrades));
        } else if (trades.length > 0) {
          // Local has trades, cloud is empty: push local trades to cloud
          await batchSyncUserTrades(currentUser.id, trades);
        }

        // 2. Fetch cloud strategies
        const cloudStrategies = await fetchUserStrategies(currentUser.id);
        if (cloudStrategies && cloudStrategies.length > 0) {
          setStrategies(cloudStrategies);
          localStorage.setItem('tradepulse_strategies', JSON.stringify(cloudStrategies));
        }

        // 3. Fetch user settings
        const settings = await fetchUserSettings(currentUser.id);
        if (settings?.startingBalance) {
          setStartingBalance(settings.startingBalance);
          localStorage.setItem('tradepulse_balance', String(settings.startingBalance));
        }
      } catch (err) {
        console.error('Error synchronizing with Supabase:', err);
      } finally {
        setIsSyncing(false);
      }
    },
    [isConfigured, trades]
  );

  // Manual sync triggered from UserMenu
  const handleManualSync = async () => {
    if (user) {
      await syncWithCloud(user);
    }
  };

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!supabase) return;

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        syncWithCloud(currentUser);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' && currentUser) {
        syncWithCloud(currentUser);
      } else if (event === 'SIGNED_OUT') {
        // Retain local state or start clean
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncWithCloud]);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('tradepulse_trades', JSON.stringify(trades));
    // Also sync to backend API in background so /api/trades is populated
    fetch('/api/trades/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trades }),
    }).catch(() => {
      // ignore transient network errors in preview
    });
  }, [trades]);

  useEffect(() => {
    localStorage.setItem('tradepulse_strategies', JSON.stringify(strategies));
  }, [strategies]);

  useEffect(() => {
    localStorage.setItem('tradepulse_balance', String(startingBalance));
  }, [startingBalance]);

  // Derived calculations
  const performanceStats = useMemo(() => calculateStats(trades), [trades]);
  const equityCurveData = useMemo(
    () => generateEquityCurve(trades, startingBalance),
    [trades, startingBalance]
  );

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

    // Save to Supabase cloud if authenticated
    if (user && isConfigured) {
      try {
        await upsertUserTrade(user.id, tradeToSave);
      } catch (err) {
        console.error('Failed to sync saved trade to Supabase:', err);
      }
    }
  };

  const handleDeleteTrade = async (id: string) => {
    setTrades((prev) => prev.filter((t) => t.id !== id));

    // Delete from Supabase cloud if authenticated
    if (user && isConfigured) {
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
  const handleImportCsv = async (imported: Trade[]) => {
    setTrades((prev) => [...imported, ...prev]);

    // Push batch to Supabase if authenticated
    if (user && isConfigured) {
      try {
        await batchSyncUserTrades(user.id, imported);
      } catch (err) {
        console.error('Failed to batch sync imported trades:', err);
      }
    }
  };

  // Pre-fill trade from Risk Calculator
  const handlePreFillFromCalculator = (params: {
    symbol?: string;
    assetClass: AssetClass;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    quantity: number;
    direction: 'long' | 'short';
  }) => {
    setEditingTrade({
      symbol: params.symbol || 'NVDA',
      assetClass: params.assetClass,
      entryPrice: params.entryPrice,
      stopLoss: params.stopLoss,
      takeProfit: params.takeProfit,
      quantity: params.quantity,
      direction: params.direction,
      status: 'closed',
      date: new Date().toISOString().split('T')[0],
      time: '09:45',
    });
    setIsTradeModalOpen(true);
  };

  // Load sample demo trades for exploration
  const handleLoadDemoTrades = () => {
    if (trades.length > 0) {
      if (!window.confirm('Load sample trades? Existing trades will be preserved alongside sample entries.')) {
        return;
      }
    }
    setTrades(SAMPLE_DEMO_TRADES);
    localStorage.setItem('tradepulse_trades', JSON.stringify(SAMPLE_DEMO_TRADES));
  };

  // Reset or clear data
  const handleResetData = () => {
    if (window.confirm('Clear all trades from your local journal to start completely fresh?')) {
      setTrades([]);
      localStorage.setItem('tradepulse_trades', JSON.stringify([]));
    }
  };

  // Strategy management
  const handleAddStrategy = async (newStrat: Strategy) => {
    setStrategies((prev) => [...prev, newStrat]);
    if (user && isConfigured) {
      try {
        await upsertUserStrategy(user.id, newStrat);
      } catch (e) {
        console.error('Error saving strategy:', e);
      }
    }
  };

  const handleUpdateStrategy = async (updatedStrat: Strategy) => {
    setStrategies((prev) => prev.map((s) => (s.id === updatedStrat.id ? updatedStrat : s)));
    if (user && isConfigured) {
      try {
        await upsertUserStrategy(user.id, updatedStrat);
      } catch (e) {
        console.error('Error updating strategy:', e);
      }
    }
  };

  const handleDeleteStrategy = async (id: string) => {
    setStrategies((prev) => prev.filter((s) => s.id !== id));
    if (user && isConfigured) {
      try {
        await deleteUserStrategyFromCloud(user.id, id);
      } catch (e) {
        console.error('Error deleting strategy:', e);
      }
    }
  };

  const handleUpdateBalance = (newBalance: number) => {
    setStartingBalance(newBalance);
    if (user && isConfigured) {
      saveUserSettings(user.id, newBalance);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f5f0] text-[#2c1e16] flex flex-col font-sans selection:bg-[#a06235] selection:text-white">
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
        onSignOut={() => setUser(null)}
        onSyncCloud={handleManualSync}
        isSyncing={isSyncing}
        trades={trades}
        onLoadDemoTrades={handleLoadDemoTrades}
      />

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 lg:p-8">
        {activeTab === 'dashboard' && (
          <Dashboard
            stats={performanceStats}
            trades={trades}
            equityData={equityCurveData}
            startingBalance={startingBalance}
            onAddTrade={handleAddTradeClick}
            onOpenChecklist={() => setIsChecklistOpen(true)}
            onNavigateToTab={setActiveTab}
            onSelectDate={() => setActiveTab('journal')}
            onLoadDemoTrades={trades.length === 0 ? handleLoadDemoTrades : undefined}
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
          />
        )}

        {activeTab === 'review' && (
          <DailyReviewView
            trades={trades}
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

        {activeTab === 'support' && (
          <SupportAndApi trades={trades} stats={performanceStats} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#e8dfd5] bg-[#f0e9df] py-6 px-4 text-center text-xs text-[#7d695b]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#3d2b20]">TradePulse</span>
            <span>• Quantitative Journal &amp; Edge Analytics</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span className="text-[#2e7d32] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#2e7d32]"></span>
              {user ? 'Supabase Cloud Synced' : isConfigured ? 'Supabase Online' : 'Local Storage Active'}
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

      {/* Supabase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          setIsAuthModalOpen(false);
        }}
        onContinueAsGuest={() => {
          setIsAuthModalOpen(false);
        }}
      />

      {/* PWA Offline Network Toast */}
      <OfflineIndicator />
    </div>
  );
}
