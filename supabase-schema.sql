-- ==============================================================================
-- TradePulse - Supabase PostgreSQL Schema & Security Policies
-- Enhanced with:
-- 1. User Registration & Profile Management
-- 2. User Login Session History & Security Audit Logs
-- 3. Trade Execution Journal linked directly to Registered Users
-- 4. User Account Settings & Trading Strategies Playbook
-- 5. Row-Level Security (RLS) & Performance Indexes
-- 6. Analytical Views linking Users, Logins, and Trade Performance
-- ==============================================================================
-- Run this script in your Supabase project's SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. User Profiles Table (extends Supabase auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'trader',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. User Login Sessions & Security Audit Table
-- Tracks every login timestamp, IP address, device/user-agent, and status
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_logins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  login_timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED', 'REFRESH'
  auth_provider TEXT DEFAULT 'email',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. User Account Settings Table (starting balance, risk %, preferences)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  starting_balance NUMERIC DEFAULT 25000.00,
  currency TEXT DEFAULT 'USD',
  risk_per_trade_pct NUMERIC DEFAULT 1.0,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. Strategies Table (Trader's playbook setups)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.strategies (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#78350f',
  rules JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. Trades Table (Complete execution journal linked to registered users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trades (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  exit_date TEXT,
  exit_time TEXT,
  symbol TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'closed',
  outcome TEXT NOT NULL DEFAULT 'breakeven',
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC DEFAULT 0,
  quantity NUMERIC NOT NULL,
  stop_loss NUMERIC DEFAULT 0,
  take_profit NUMERIC DEFAULT 0,
  fees NUMERIC DEFAULT 0,
  gross_pnl NUMERIC DEFAULT 0,
  net_pnl NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  planned_rr NUMERIC DEFAULT 0,
  realized_rr NUMERIC DEFAULT 0,
  strategy TEXT DEFAULT 'Discretionary',
  rating INTEGER DEFAULT 0,
  emotion TEXT DEFAULT 'Disciplined',
  mistake TEXT,
  notes TEXT,
  chart_url TEXT,
  market_session TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. Daily Reviews Table (Pre-market prep & End-of-day debriefs)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.daily_reviews (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,
  grade TEXT DEFAULT 'A',
  market_conditions TEXT,
  sleep_quality INTEGER DEFAULT 8,
  focus_level INTEGER DEFAULT 8,
  rules_followed_pct INTEGER DEFAULT 100,
  checklist_completed BOOLEAN DEFAULT TRUE,
  morning_notes TEXT,
  evening_notes TEXT,
  key_takeaway TEXT,
  chart_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- High Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON public.trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON public.trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_user_logins_user_timestamp ON public.user_logins(user_id, login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON public.strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date ON public.daily_reviews(user_id, date DESC);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Strict Multi-Tenant Isolation: each user can only read/write their own records
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User Logins Policies
DROP POLICY IF EXISTS "Users can view own login history" ON public.user_logins;
CREATE POLICY "Users can view own login history"
  ON public.user_logins FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own login session" ON public.user_logins;
CREATE POLICY "Users can insert own login session"
  ON public.user_logins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User Settings Policies
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Strategies Policies
DROP POLICY IF EXISTS "Users can view own strategies" ON public.strategies;
CREATE POLICY "Users can view own strategies"
  ON public.strategies FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own strategies" ON public.strategies;
CREATE POLICY "Users can insert own strategies"
  ON public.strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own strategies" ON public.strategies;
CREATE POLICY "Users can update own strategies"
  ON public.strategies FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own strategies" ON public.strategies;
CREATE POLICY "Users can delete own strategies"
  ON public.strategies FOR DELETE
  USING (auth.uid() = user_id);

-- Trades Policies
DROP POLICY IF EXISTS "Users can view own trades" ON public.trades;
CREATE POLICY "Users can view own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own trades" ON public.trades;
CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own trades" ON public.trades;
CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own trades" ON public.trades;
CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE
  USING (auth.uid() = user_id);

-- Daily Reviews Policies
DROP POLICY IF EXISTS "Users can view own reviews" ON public.daily_reviews;
CREATE POLICY "Users can view own reviews"
  ON public.daily_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reviews" ON public.daily_reviews;
CREATE POLICY "Users can insert own reviews"
  ON public.daily_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reviews" ON public.daily_reviews;
CREATE POLICY "Users can update own reviews"
  ON public.daily_reviews FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reviews" ON public.daily_reviews;
CREATE POLICY "Users can delete own reviews"
  ON public.daily_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Automatic User Registration Trigger
-- Auto-populates profiles and user_settings when a user signs up through Supabase Auth
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      updated_at = NOW();

  -- Create initial account settings
  INSERT INTO public.user_settings (user_id, starting_balance)
  VALUES (NEW.id, 25000.00)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create initial default trading strategies for the new user
  INSERT INTO public.strategies (id, user_id, name, description, color, rules)
  VALUES
    (
      'strat-breakout-' || NEW.id,
      NEW.id,
      'Opening Range Breakout',
      'High-momentum break of the first 15-minute high/low on heavy volume.',
      '#78350f',
      '["Identify 15m high/low", "Wait for volume spike > 1.5x average", "Enter on 5m candle close outside range", "Stop loss at range midpoint"]'::JSONB
    ),
    (
      'strat-pullback-' || NEW.id,
      NEW.id,
      'VWAP Pullback Bounce',
      'Trend continuation entry when price tests institutional VWAP.',
      '#92400e',
      '["Trend must be clear above 20 EMA", "Price pulls back to VWAP with declining volume", "Enter on rejection wick / reversal bar", "Target prior swing high (min 2:1 RR)"]'::JSONB
    )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Helper Function: Record Login Event & Update Profile Stats
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.log_user_login(
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Insert login audit record
  INSERT INTO public.user_logins (user_id, email, login_timestamp, ip_address, user_agent, status)
  VALUES (v_user_id, v_email, NOW(), p_ip_address, p_user_agent, 'SUCCESS')
  RETURNING id INTO v_log_id;

  -- Update profiles with latest login time and increment login count
  UPDATE public.profiles
  SET last_login_at = NOW(),
      login_count = COALESCE(login_count, 0) + 1,
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- Analytical View: Trader Dashboard with User Info, Last Login & Performance
-- ==============================================================================
CREATE OR REPLACE VIEW public.vw_user_trade_summary AS
SELECT
  p.id AS user_id,
  p.email,
  p.full_name,
  p.last_login_at,
  p.login_count,
  COUNT(t.id) AS total_trades,
  COUNT(CASE WHEN t.outcome = 'win' THEN 1 END) AS winning_trades,
  COUNT(CASE WHEN t.outcome = 'loss' THEN 1 END) AS losing_trades,
  ROUND(
    CASE 
      WHEN COUNT(t.id) = 0 THEN 0.00
      ELSE (COUNT(CASE WHEN t.outcome = 'win' THEN 1 END)::NUMERIC / COUNT(t.id)::NUMERIC) * 100 
    END, 2
  ) AS win_rate_pct,
  COALESCE(SUM(t.net_pnl), 0) AS total_net_pnl,
  COALESCE(AVG(t.net_pnl), 0) AS average_trade_pnl,
  COALESCE(MAX(t.net_pnl), 0) AS largest_win,
  COALESCE(MIN(t.net_pnl), 0) AS largest_loss
FROM public.profiles p
LEFT JOIN public.trades t ON p.id = t.user_id
GROUP BY p.id, p.email, p.full_name, p.last_login_at, p.login_count;
