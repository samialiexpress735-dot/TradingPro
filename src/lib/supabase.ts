import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Trade, Strategy, DailyReview, CapitalTransaction } from '../types/trade';

// Production Supabase project configuration
export const DEFAULT_SUPABASE_URL = 'https://tvzvzbsndptjcjjmwxfa.supabase.co';
export const DEFAULT_SUPABASE_KEY = 'sb_publishable_M3VpKjLKHNS2skqEJ9yO5Q_1ZnGPaU7';

// Retrieve Supabase environment variables or defaults
export function getSupabaseCredentials(): { url: string; key: string } {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  let localUrl = '';
  let localKey = '';
  try {
    if (typeof window !== 'undefined') {
      localUrl = (localStorage.getItem('tradepulse_supabase_url') || '').trim();
      localKey = (localStorage.getItem('tradepulse_supabase_anon_key') || '').trim();
    }
  } catch {}

  const finalUrl =
    envUrl && !envUrl.includes('your-project') && !envUrl.includes('placeholder')
      ? envUrl
      : localUrl || DEFAULT_SUPABASE_URL;

  const finalKey =
    envKey && !envKey.includes('your-anon-key') && !envKey.includes('placeholder')
      ? envKey
      : localKey || DEFAULT_SUPABASE_KEY;

  return { url: finalUrl, key: finalKey };
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

// Create singleton Supabase client
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
 * Guarantees that public.profiles and public.user_settings records exist for the authenticated user
 */
export async function ensureUserProfileExists(userId: string, email: string, fullName?: string) {
  if (!supabase) return;
  try {
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!existing) {
      await supabase.from('profiles').upsert(
        {
          id: userId,
          email: email,
          full_name: fullName || email.split('@')[0],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    const { data: existingSettings } = await supabase
      .from('user_settings')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingSettings) {
      await supabase.from('user_settings').upsert(
        {
          user_id: userId,
          starting_balance: 25000,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    }
  } catch (err) {
    console.debug('Profile ensure note:', err);
  }
}

/**
 * Register account: automatically registers to Supabase Auth and provisions database records.
 * If user already exists in Supabase, attempts immediate sign-in with the provided password.
 */
export async function signUpWithEmail(email: string, password: string, fullName?: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = fullName?.trim() || normalizedEmail.split('@')[0];
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ais-pre-vcyjg6w55tp5nnavqenjub-988510191238.europe-west2.run.app';

  // 1. Dual-register on centralized backend first
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

  // 2. If Supabase is configured, register to Supabase Auth
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
      // If the user already registered in Supabase, attempt instant sign-in with the password!
      if (
        error.message?.includes('User already registered') ||
        error.message?.includes('already exists') ||
        (error as any).code === 'user_already_exists'
      ) {
        try {
          const signInRes = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password,
          });

          if (signInRes.data?.user) {
            await ensureUserProfileExists(signInRes.data.user.id, normalizedEmail, displayName);
            await recordLoginSession(signInRes.data.user.id, normalizedEmail);
            const appUser: AppUser = {
              id: signInRes.data.user.id,
              email: normalizedEmail,
              user_metadata: {
                full_name: displayName,
              },
            };
            setStoredUserSession(appUser, signInRes.data.session?.access_token);
            return { user: appUser, session: signInRes.data.session };
          }
        } catch (signInErr: any) {
          if (signInErr?.message?.toLowerCase().includes('email not confirmed')) {
            throw new Error(
              'Your account was registered before email confirmation was turned off. In your Supabase Dashboard -> Authentication -> Users, click the 3 dots next to your email and select "Confirm user" (or delete it to re-register).'
            );
          }
          throw new Error('An account with this email already exists. Please enter your correct password or sign in.');
        }
      }

      // If Supabase failed but backend succeeded
      if (serverResult.user) {
        setStoredUserSession(serverResult.user, serverResult.token);
        return { user: serverResult.user, session: { access_token: serverResult.token } };
      }
      throw error;
    }

    if (data?.user) {
      // Ensure profile & settings rows exist in public schema
      await ensureUserProfileExists(data.user.id, normalizedEmail, displayName);
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
        // If Supabase reports "Email not confirmed", provide exact guidance
        if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('not confirmed')
        ) {
          throw new Error(
            'Your account was registered before email confirmation was turned off. In Supabase Dashboard -> Authentication -> Users, click the 3 dots next to your email and choose "Confirm user", or delete it to re-register.'
          );
        }
        throw error;
      }

      if (data?.user) {
        await ensureUserProfileExists(
          data.user.id,
          normalizedEmail,
          data.user.user_metadata?.full_name || normalizedEmail.split('@')[0]
        );
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
 * Helpers shared by the trade sync functions below.
 */
function tradeToRow(userId: string, trade: Trade) {
  return {
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
}

function rowToTrade(row: any): Trade {
  return {
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
  };
}

/** True only when the browser holds a real Supabase auth session for this user (needed to pass RLS). */
async function hasSupabaseSession(userId: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id === userId;
  } catch {
    return false;
  }
}

/** Calls the optional Express backend. Resolves to parsed JSON, or null if unreachable / not JSON (e.g. static hosting). */
async function callServer(url: string, init: RequestInit, userId: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'x-user-id': userId, ...(init.headers || {}) },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/json')) return null;
    const json = await res.json();
    return json && json.success ? json : null;
  } catch {
    return null;
  }
}

export interface FetchTradesResult {
  trades: Trade[];
  /** false when no data source answered, so the caller must NOT treat an empty list as "user has no trades". */
  reliable: boolean;
}

/**
 * Fetch all trades belonging to the user across devices.
 * Combines Supabase (real auth session) and the optional Express backend; Supabase wins on conflicts.
 */
export async function fetchUserTradesDetailed(userId: string): Promise<FetchTradesResult> {
  const byId = new Map<string, Trade>();
  let reliable = false;

  // 1. Express backend (optional mirror / fallback for non-Supabase accounts)
  const server = await callServer(`/api/user/trades?userId=${encodeURIComponent(userId)}`, {}, userId);
  if (server && Array.isArray(server.trades)) {
    reliable = true;
    server.trades.forEach((t: Trade) => byId.set(t.id, t));
  }

  // 2. Supabase PostgreSQL (authoritative when a real session exists)
  if (await hasSupabaseSession(userId)) {
    try {
      const { data, error } = await supabase!
        .from('trades')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .limit(10000);
      if (error) {
        console.warn('Supabase fetch failed:', error.message);
      } else if (data) {
        reliable = true;
        data.forEach((row: any) => byId.set(row.id, rowToTrade(row)));
      }
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
    }
  }

  return { trades: [...byId.values()], reliable };
}

/** Backwards-compatible wrapper. */
export async function fetchUserTrades(userId: string): Promise<Trade[]> {
  return (await fetchUserTradesDetailed(userId)).trades;
}

/**
 * Upsert single trade for the user. Resolves to true only when the save was actually confirmed.
 */
export async function upsertUserTrade(userId: string, trade: Trade): Promise<boolean> {
  return batchSyncUserTrades(userId, [trade]);
}

/**
 * Bulk upsert trades for the user. Resolves to true only when the save was actually confirmed.
 */
export async function batchSyncUserTrades(userId: string, trades: Trade[]): Promise<boolean> {
  if (trades.length === 0) return true;

  let confirmed = false;
  let failed = false;

  if (await hasSupabaseSession(userId)) {
    try {
      const CHUNK = 500;
      for (let i = 0; i < trades.length; i += CHUNK) {
        const rows = trades.slice(i, i + CHUNK).map((t) => tradeToRow(userId, t));
        const { error } = await supabase!.from('trades').upsert(rows, { onConflict: 'id' });
        if (error) throw error;
      }
      confirmed = true;
    } catch (e) {
      failed = true;
      console.warn('Supabase trade save failed:', e);
    }
  }

  // Express backend mirror (only the trades that changed - never the whole list)
  const serverRes = await Promise.all(
    trades.map((trade) =>
      callServer(
        '/api/user/trades',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, trade }),
        },
        userId
      )
    )
  );
  if (serverRes.every(Boolean)) confirmed = true;

  return confirmed && !failed;
}

/**
 * Delete trade for user. Resolves to true only when the delete was actually confirmed.
 */
export async function deleteUserTradeFromCloud(userId: string, tradeId: string): Promise<boolean> {
  let confirmed = false;
  let failed = false;

  if (await hasSupabaseSession(userId)) {
    try {
      const { error } = await supabase!.from('trades').delete().eq('id', tradeId).eq('user_id', userId);
      if (error) throw error;
      confirmed = true;
    } catch (e) {
      failed = true;
      console.warn('Supabase trade delete failed:', e);
    }
  }

  const serverRes = await callServer(
    `/api/user/trades/${encodeURIComponent(tradeId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
    userId
  );
  if (serverRes) confirmed = true;

  return confirmed && !failed;
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
/**
 * User account settings interface for Supabase storage
 */
export interface UserSettings {
  startingBalance?: number;
  monthlyTargetAmount?: number;
  monthlyTargetType?: 'dollar' | 'percent';
  binanceApiKey?: string;
  currency?: string;
  riskPerTradePct?: number;
  theme?: string;
  capitalTransactions?: CapitalTransaction[];
  googleSiteVerification?: string;
  adSensePublisherId?: string;
  adSenseSlotId?: string;
  adSenseAutoAds?: boolean;
  adSenseEnabled?: boolean;
}

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return {
          startingBalance: data.starting_balance !== null && data.starting_balance !== undefined ? Number(data.starting_balance) : 25000,
          monthlyTargetAmount: data.monthly_target_amount !== null && data.monthly_target_amount !== undefined ? Number(data.monthly_target_amount) : 2500,
          monthlyTargetType: data.monthly_target_type === 'percent' ? 'percent' : 'dollar',
          binanceApiKey: data.binance_api_key || '',
          currency: data.currency || 'USD',
          riskPerTradePct: data.risk_per_trade_pct !== null && data.risk_per_trade_pct !== undefined ? Number(data.risk_per_trade_pct) : 1.0,
          theme: data.theme || 'light',
          capitalTransactions: Array.isArray(data.capital_adjustments) ? data.capital_adjustments : [],
          googleSiteVerification: data.google_site_verification || '',
          adSensePublisherId: data.adsense_publisher_id || '',
          adSenseSlotId: data.adsense_slot_id || '',
          adSenseAutoAds: data.adsense_auto_ads ?? true,
          adSenseEnabled: data.adsense_enabled ?? false,
        };
      }
    } catch (e) {
      console.warn('Error fetching user settings from Supabase:', e);
    }
  }

  try {
    const res = await fetch(`/api/user/settings?userId=${encodeURIComponent(userId)}`, {
      headers: { 'x-user-id': userId },
    });
    const result = await res.json();
    if (result.success && result.settings) {
      return result.settings;
    }
  } catch {}

  return null;
}

export async function saveUserSettings(
  userId: string,
  settings: number | Partial<UserSettings>
): Promise<void> {
  const payloadData: Partial<UserSettings> =
    typeof settings === 'number' ? { startingBalance: settings } : settings;

  if (supabase) {
    try {
      const dbPayload: Record<string, any> = {
        user_id: userId,
        updated_at: new Date().toISOString(),
      };
      if (payloadData.startingBalance !== undefined) dbPayload.starting_balance = payloadData.startingBalance;
      if (payloadData.monthlyTargetAmount !== undefined) dbPayload.monthly_target_amount = payloadData.monthlyTargetAmount;
      if (payloadData.monthlyTargetType !== undefined) dbPayload.monthly_target_type = payloadData.monthlyTargetType;
      if (payloadData.binanceApiKey !== undefined) dbPayload.binance_api_key = payloadData.binanceApiKey;
      if (payloadData.currency !== undefined) dbPayload.currency = payloadData.currency;
      if (payloadData.riskPerTradePct !== undefined) dbPayload.risk_per_trade_pct = payloadData.riskPerTradePct;
      if (payloadData.theme !== undefined) dbPayload.theme = payloadData.theme;
      if (payloadData.capitalTransactions !== undefined) dbPayload.capital_adjustments = payloadData.capitalTransactions;
      if (payloadData.googleSiteVerification !== undefined) dbPayload.google_site_verification = payloadData.googleSiteVerification;
      if (payloadData.adSensePublisherId !== undefined) dbPayload.adsense_publisher_id = payloadData.adSensePublisherId;
      if (payloadData.adSenseSlotId !== undefined) dbPayload.adsense_slot_id = payloadData.adSenseSlotId;
      if (payloadData.adSenseAutoAds !== undefined) dbPayload.adsense_auto_ads = payloadData.adSenseAutoAds;
      if (payloadData.adSenseEnabled !== undefined) dbPayload.adsense_enabled = payloadData.adSenseEnabled;

      const { error } = await supabase.from('user_settings').upsert(dbPayload, { onConflict: 'user_id' });
      // If error occurred (e.g. some new columns not present in user's Supabase yet), retry with core fields
      if (error) {
        const corePayload = {
          user_id: userId,
          starting_balance: dbPayload.starting_balance,
          updated_at: dbPayload.updated_at,
        };
        await supabase.from('user_settings').upsert(corePayload, { onConflict: 'user_id' });
      }
    } catch (e) {
      console.warn('Error saving user settings to Supabase:', e);
    }
  }

  try {
    await fetch('/api/user/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({ userId, settings: payloadData }),
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
