import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Trade, Strategy, DailyReview } from '../types/trade';

// Retrieve Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Validates whether Supabase credentials have been properly configured
 */
export function isSupabaseConfigured(): boolean {
  return (
    typeof supabaseUrl === 'string' &&
    supabaseUrl.trim().length > 0 &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('placeholder') &&
    typeof supabaseAnonKey === 'string' &&
    supabaseAnonKey.trim().length > 0 &&
    !supabaseAnonKey.includes('your-anon-key')
  );
}

// Create the singleton Supabase client or null if not configured
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ==========================================
// Authentication Helpers
// ==========================================

export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || email.split('@')[0],
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function sendPasswordResetEmail(email: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });

  if (error) throw error;
  return data;
}

export async function signOutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Sign out error:', error);
}

export async function getCurrentSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting session:', error);
    return null;
  }
  return data.session;
}

// ==========================================
// Cloud Database CRUD operations
// ==========================================

/**
 * Fetch all trades belonging to the authenticated user
 */
export async function fetchUserTrades(userId: string): Promise<Trade[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching trades from Supabase:', error);
    throw error;
  }

  if (!data) return [];

  // Map database columns to client Trade interface
  return data.map((row: any) => ({
    id: row.id,
    date: row.date,
    time: row.time || '09:30',
    exitDate: row.exit_date,
    exitTime: row.exit_time,
    symbol: row.symbol,
    assetClass: row.asset_class,
    direction: row.direction,
    status: row.status,
    outcome: row.outcome,
    entryPrice: Number(row.entry_price),
    exitPrice: Number(row.exit_price || 0),
    quantity: Number(row.quantity),
    stopLoss: Number(row.stop_loss || 0),
    takeProfit: Number(row.take_profit || 0),
    fees: Number(row.fees || 0),
    grossPnl: Number(row.gross_pnl || 0),
    netPnl: Number(row.net_pnl || 0),
    roi: Number(row.roi || 0),
    plannedRR: Number(row.planned_rr || 0),
    realizedRR: Number(row.realized_rr || 0),
    strategy: row.strategy || 'Discretionary',
    rating: Number(row.rating || 0),
    emotion: row.emotion || 'Disciplined',
    mistake: row.mistake,
    notes: row.notes || '',
    chartUrl: row.chart_url,
    marketSession: row.market_session,
  }));
}

/**
 * Upsert a single trade to Supabase
 */
export async function upsertUserTrade(userId: string, trade: Trade): Promise<void> {
  if (!supabase) return;

  const payload = {
    id: trade.id,
    user_id: userId,
    date: trade.date,
    time: trade.time,
    exit_date: trade.exitDate || null,
    exit_time: trade.exitTime || null,
    symbol: trade.symbol,
    asset_class: trade.assetClass,
    direction: trade.direction,
    status: trade.status,
    outcome: trade.outcome,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    quantity: trade.quantity,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    fees: trade.fees,
    gross_pnl: trade.grossPnl,
    net_pnl: trade.netPnl,
    roi: trade.roi,
    planned_rr: trade.plannedRR,
    realized_rr: trade.realizedRR,
    strategy: trade.strategy,
    rating: trade.rating,
    emotion: trade.emotion,
    mistake: trade.mistake || null,
    notes: trade.notes || '',
    chart_url: trade.chartUrl || null,
    market_session: trade.marketSession || null,
  };

  const { error } = await supabase.from('trades').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('Error saving trade to Supabase:', error);
    throw error;
  }
}

/**
 * Bulk sync trades to Supabase
 */
export async function batchSyncUserTrades(userId: string, trades: Trade[]): Promise<void> {
  if (!supabase || trades.length === 0) return;

  const payloads = trades.map((trade) => ({
    id: trade.id,
    user_id: userId,
    date: trade.date,
    time: trade.time,
    exit_date: trade.exitDate || null,
    exit_time: trade.exitTime || null,
    symbol: trade.symbol,
    asset_class: trade.assetClass,
    direction: trade.direction,
    status: trade.status,
    outcome: trade.outcome,
    entry_price: trade.entryPrice,
    exit_price: trade.exitPrice,
    quantity: trade.quantity,
    stop_loss: trade.stopLoss,
    take_profit: trade.takeProfit,
    fees: trade.fees,
    gross_pnl: trade.grossPnl,
    net_pnl: trade.netPnl,
    roi: trade.roi,
    planned_rr: trade.plannedRR,
    realized_rr: trade.realizedRR,
    strategy: trade.strategy,
    rating: trade.rating,
    emotion: trade.emotion,
    mistake: trade.mistake || null,
    notes: trade.notes || '',
    chart_url: trade.chartUrl || null,
    market_session: trade.marketSession || null,
  }));

  const { error } = await supabase.from('trades').upsert(payloads, { onConflict: 'id' });
  if (error) {
    console.error('Error batch syncing trades:', error);
    throw error;
  }
}

/**
 * Delete a trade from Supabase
 */
export async function deleteUserTradeFromCloud(userId: string, tradeId: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', tradeId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting trade from Supabase:', error);
    throw error;
  }
}

/**
 * Fetch user strategies
 */
export async function fetchUserStrategies(userId: string): Promise<Strategy[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching strategies from Supabase:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    color: row.color || '#10b981',
    rules: Array.isArray(row.rules) ? row.rules : [],
  }));
}

/**
 * Upsert strategy to Supabase
 */
export async function upsertUserStrategy(userId: string, strategy: Strategy): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('strategies').upsert(
    {
      id: strategy.id,
      user_id: userId,
      name: strategy.name,
      description: strategy.description,
      color: strategy.color,
      rules: strategy.rules,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Error upserting strategy:', error);
    throw error;
  }
}

/**
 * Delete strategy from Supabase
 */
export async function deleteUserStrategyFromCloud(userId: string, strategyId: string): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', strategyId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting strategy:', error);
    throw error;
  }
}

/**
 * Fetch user account settings (balance, currency)
 */
export async function fetchUserSettings(userId: string): Promise<{ startingBalance?: number } | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    // Row might not exist yet; that's fine
    return null;
  }

  return {
    startingBalance: data?.starting_balance ? Number(data.starting_balance) : undefined,
  };
}

/**
 * Save user account settings
 */
export async function saveUserSettings(userId: string, startingBalance: number): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: userId,
      starting_balance: startingBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('Error saving user settings:', error);
  }
}

/**
 * Fetch daily reviews
 */
export async function fetchUserDailyReviews(userId: string): Promise<DailyReview[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('daily_reviews')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching reviews:', error);
    return [];
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    date: row.date,
    grade: row.grade,
    marketConditions: row.market_conditions,
    sleepQuality: row.sleep_quality,
    focusLevel: row.focus_level,
    rulesFollowedPct: row.rules_followed_pct,
    checklistCompleted: row.checklist_completed,
    morningNotes: row.morning_notes || '',
    eveningNotes: row.evening_notes || '',
    keyTakeaway: row.key_takeaway || '',
    chartUrl: row.chart_url,
    updatedAt: row.updated_at,
  }));
}

/**
 * Save daily review
 */
export async function upsertUserDailyReview(userId: string, review: DailyReview): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from('daily_reviews').upsert(
    {
      id: review.id,
      user_id: userId,
      date: review.date,
      grade: review.grade,
      market_conditions: review.marketConditions,
      sleep_quality: review.sleepQuality,
      focus_level: review.focusLevel,
      rules_followed_pct: review.rulesFollowedPct,
      checklist_completed: review.checklistCompleted,
      morning_notes: review.morningNotes,
      evening_notes: review.eveningNotes,
      key_takeaway: review.keyTakeaway,
      chart_url: review.chartUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('Error saving review to Supabase:', error);
  }
}
