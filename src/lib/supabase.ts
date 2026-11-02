import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Trade, Strategy, DailyReview } from '../types/trade';

// Retrieve Supabase environment variables
export function getSupabaseCredentials(): { url: string; key: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  return { url: envUrl, key: envKey };
}

/**
 * Validates whether Supabase credentials have been properly configured
 */
export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials();
  return (
    url.length > 0 &&
    !url.includes('your-project') &&
    !url.includes('placeholder') &&
    key.length > 0 &&
    !key.includes('your-anon-key')
  );
}

const initialCreds = getSupabaseCredentials();

// Create singleton Supabase client if environment credentials are provided
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(initialCreds.url, initialCreds.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

// ==========================================
// Universal Authentication Helpers (Multi-Device SaaS)
// ==========================================

export interface AppUser {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
  };
  created_at?: string;
}

export function getStoredUserSession(): AppUser | null {
  try {
    const raw = localStorage.getItem('tradepulse_user_session');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to parse stored user session:', err);
  }
  return null;
}

export function setStoredUserSession(user: AppUser | null, token?: string) {
  try {
    if (user) {
      localStorage.setItem('tradepulse_user_session', JSON.stringify(user));
      if (token) {
        localStorage.setItem('tradepulse_auth_token', token);
      }
    } else {
      localStorage.removeItem('tradepulse_user_session');
      localStorage.removeItem('tradepulse_auth_token');
    }
  } catch {}
}

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('tradepulse_auth_token');
  } catch {
    return null;
  }
}

export async function recordLoginSession(userId: string, email: string): Promise<void> {
  if (supabase) {
    try {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser';
      await supabase.from('user_logins').insert({
        user_id: userId,
        email: email,
        user_agent: userAgent,
        status: 'SUCCESS',
      });
    } catch (err) {
      console.debug('Supabase user_logins audit skipped:', err);
    }
  }
}

export async function fetchUserLoginHistory(userId: string): Promise<any[]> {
  // 1. Try Supabase if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('user_logins')
        .select('*')
        .eq('user_id', userId)
        .order('login_timestamp', { ascending: false })
        .limit(10);
      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}
  }

  // 2. Fetch from backend server API
  try {
    const res = await fetch(`/api/user/logins?userId=${encodeURIComponent(userId)}`, {
      headers: {
        'x-user-id': userId,
      },
    });
    const result = await res.json();
    if (result.success && Array.isArray(result.logs)) {
      return result.logs.map((l: any) => ({
        id: l.id,
        login_timestamp: l.timestamp,
        user_agent: l.userAgent,
        status: l.status,
      }));
    }
  } catch {}

  return [];
}

/**
 * Register account: automatically registers to Supabase if configured,
 * or registers to the centralized backend server with full multi-device support.
 */
/**
 * Register account: automatically registers to Supabase if configured,
 * and registers to the centralized backend server with full multi-device support.
 * Bypasses email verification friction by setting redirect URLs and providing instant session.
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = fullName?.trim() || normalizedEmail.split('@')[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-vcyjg6w55tp5nnavqenjub-988510191238.europe-west2.run.app';

  // 1. Dual-register on centralized backend first so account is immediately accessible across any device
  let serverResult: { user?: AppUser; token?: string } = {};
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: normalizedEmail,
        password,
        fullName: displayName,
      }),
    });
    if (res.ok) {
      serverResult = await res.json();
    }
  } catch (err) {
    console.debug('Backend signup sync notice:', err);
  }

  // 2. If Supabase is configured, also register to Supabase Auth
  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          full_name: displayName,
        },
        emailRedirectTo: `${origin}/`,
      },
    });

    if (error) {
      // If Supabase failed because user already exists or email rate limit, but backend succeeded
      if (serverResult.user) {
        setStoredUserSession(serverResult.user, serverResult.token);
        return { user: serverResult.user, session: { access_token: serverResult.token } };
      }
      throw error;
    }

    if (data?.user) {
      await recordLoginSession(data.user.id, data.user.email || normalizedEmail);
      const appUser: AppUser = {
        id: data.user.id,
        email: data.user.email || normalizedEmail,
        user_metadata: {
          full_name: displayName,
        },
      };
      setStoredUserSession(appUser, data.session?.access_token || serverResult.token);
      return { user: appUser, session: data.session || { access_token: serverResult.token } };
    }
  }

  // 3. Centralized backend database auth return
  if (serverResult.user) {
    setStoredUserSession(serverResult.user, serverResult.token);
    return { user: serverResult.user, session: { access_token: serverResult.token } };
  }

  throw new Error('Could not complete registration. Please try again.');
}

/**
 * Sign in to account: verifies credentials against Supabase or centralized backend.
 * Handles cases where email confirmation is pending in Supabase by falling back to verified backend auth.
 */
export async function signInWithEmail(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  // Try Supabase first if configured
  if (supabase) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        // If Supabase reports "Email not confirmed", try the backend credentials check
        // so the user is never blocked by pending email links!
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('not confirmed')
        ) {
          console.warn('Supabase email not confirmed, attempting direct backend sign-in...');
          const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password }),
          });
          const body = await res.json();
          if (res.ok && body.user) {
            setStoredUserSession(body.user, body.token);
            await recordLoginSession(body.user.id, body.user.email);
            return { user: body.user, session: { access_token: body.token } };
          }
          // If backend didn't have user yet, explain how to turn off confirm email in Supabase
          throw new Error(
            'Email confirmation is required by your Supabase project settings. Please turn off "Confirm email" in Supabase Dashboard -> Authentication -> Providers -> Email.'
          );
        }
        throw error;
      }

      if (data?.user) {
        await recordLoginSession(data.user.id, data.user.email || normalizedEmail);
        const appUser: AppUser = {
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          user_metadata: {
            full_name: data.user.user_metadata?.full_name || normalizedEmail.split('@')[0],
          },
        };
        setStoredUserSession(appUser, data.session?.access_token);
        return data;
      }
    } catch (err: any) {
      // If error is not a wrong password, try backend
      if (!err.message?.includes('Invalid login credentials')) {
        try {
          const res = await fetch('/api/auth/signin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password }),
          });
          const body = await res.json();
          if (res.ok && body.user) {
            setStoredUserSession(body.user, body.token);
            return { user: body.user, session: { access_token: body.token } };
          }
        } catch {}
      }
      throw err;
    }
  }

  // Centralized backend database sign in
  const res = await fetch('/api/auth/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizedEmail,
      password,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || 'Invalid email or password.');
  }

  setStoredUserSession(body.user, body.token);
  return { user: body.user, session: { access_token: body.token } };
}

export async function sendPasswordResetEmail(email: string) {
  if (supabase) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw error;
    return data;
  }
  // Server-side reset simulation
  await new Promise((r) => setTimeout(r, 600));
  return { success: true };
}

export async function signOutUser() {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Supabase signout notice:', e);
    }
  }
  setStoredUserSession(null);
}

// ==========================================
// Cloud & Server Database Operations (Per User)
// ==========================================

/**
 * Fetch all trades belonging to the authenticated user across devices
 */
export async function fetchUserTrades(userId: string): Promise<Trade[]> {
  // 1. If Supabase is active, query PostgreSQL
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (!error && data && data.length > 0) {
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
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to server DB:', err);
    }
  }

  // 2. Fetch from centralized backend server
  try {
    const res = await fetch(`/api/user/trades?userId=${encodeURIComponent(userId)}`, {
      headers: {
        'x-user-id': userId,
      },
    });
    const result = await res.json();
    if (result.success && Array.isArray(result.trades)) {
      return result.trades;
    }
  } catch (err) {
    console.error('Error fetching user trades from server API:', err);
  }

  return [];
}

/**
 * Upsert single trade for the user to cloud/server
 */
export async function upsertUserTrade(userId: string, trade: Trade): Promise<void> {
  // 1. Supabase sync if enabled
  if (supabase) {
    try {
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
      await supabase.from('trades').upsert(payload, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase upsert error:', e);
    }
  }

  // 2. Persistent Backend Server Sync
  try {
    await fetch('/api/user/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId, trade }),
    });
  } catch (err) {
    console.error('Failed to sync trade to server DB:', err);
  }
}

/**
 * Bulk sync trades for user
 */
export async function batchSyncUserTrades(userId: string, trades: Trade[]): Promise<void> {
  if (supabase && trades.length > 0) {
    try {
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
      await supabase.from('trades').upsert(payloads, { onConflict: 'id' });
    } catch (e) {
      console.warn('Supabase batch sync notice:', e);
    }
  }

  try {
    await fetch('/api/user/trades/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId, trades }),
    });
  } catch (err) {
    console.error('Failed to batch sync trades to server DB:', err);
  }
}

/**
 * Delete trade for user
 */
export async function deleteUserTradeFromCloud(userId: string, tradeId: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('trades').delete().eq('id', tradeId).eq('user_id', userId);
    } catch {}
  }

  try {
    await fetch(`/api/user/trades/${encodeURIComponent(tradeId)}?userId=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'x-user-id': userId,
      },
    });
  } catch (err) {
    console.error('Failed to delete trade on server DB:', err);
  }
}

/**
 * Fetch user strategies
 */
export async function fetchUserStrategies(userId: string): Promise<Strategy[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          color: row.color || '#10b981',
          rules: Array.isArray(row.rules) ? row.rules : [],
        }));
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/user/strategies?userId=${encodeURIComponent(userId)}`, {
      headers: { 'x-user-id': userId },
    });
    const result = await res.json();
    if (result.success && Array.isArray(result.strategies)) {
      return result.strategies;
    }
  } catch {}

  return [];
}

/**
 * Upsert user strategy
 */
export async function upsertUserStrategy(userId: string, strategy: Strategy): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('strategies').upsert(
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
    } catch {}
  }

  try {
    await fetch('/api/user/strategies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId, strategy }),
    });
  } catch {}
}

export async function deleteUserStrategyFromCloud(userId: string, strategyId: string): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('strategies').delete().eq('id', strategyId).eq('user_id', userId);
    } catch {}
  }
}

/**
 * User account settings
 */
export async function fetchUserSettings(userId: string): Promise<{ startingBalance?: number } | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (!error && data?.starting_balance) {
        return { startingBalance: Number(data.starting_balance) };
      }
    } catch {}
  }

  try {
    const res = await fetch(`/api/user/settings?userId=${encodeURIComponent(userId)}`, {
      headers: { 'x-user-id': userId },
    });
    const result = await res.json();
    if (result.success && result.settings?.startingBalance) {
      return { startingBalance: Number(result.settings.startingBalance) };
    }
  } catch {}

  return null;
}

export async function saveUserSettings(userId: string, startingBalance: number): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          starting_balance: startingBalance,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    } catch {}
  }

  try {
    await fetch('/api/user/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId, settings: { startingBalance } }),
    });
  } catch {}
}

/**
 * Daily reviews
 */
export async function fetchUserDailyReviews(userId: string): Promise<DailyReview[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('daily_reviews')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (!error && data) {
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
    } catch {}
  }
  return [];
}

export async function upsertUserDailyReview(userId: string, review: DailyReview): Promise<void> {
  if (supabase) {
    try {
      await supabase.from('daily_reviews').upsert(
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
    } catch {}
  }
}
