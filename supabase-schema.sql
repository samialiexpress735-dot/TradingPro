-- ==============================================================================
-- TradePulse - Supabase PostgreSQL Schema & Security Policies
-- Run this script in your Supabase project's SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. User Profiles Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Account Settings Table (starting balance, risk %, preferences)
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  starting_balance NUMERIC DEFAULT 25000.00,
  currency TEXT DEFAULT 'USD',
  risk_per_trade_pct NUMERIC DEFAULT 1.0,
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Strategies Table (Trader's playbook setups)
CREATE TABLE IF NOT EXISTS public.strategies (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#78350f',
  rules JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Trades Table (Complete execution journal)
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

-- 6. Daily Reviews Table (Pre-market prep & End-of-day debriefs)
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
-- Indexes for High Performance
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON public.trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_symbol ON public.trades(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON public.strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_reviews_user_date ON public.daily_reviews(user_id, date DESC);

-- ==============================================================================
-- Row Level Security (RLS) Policies
-- Ensures complete isolation: each trader can ONLY access their own records
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reviews ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- User Settings Policies
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Strategies Policies
CREATE POLICY "Users can view own strategies"
  ON public.strategies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own strategies"
  ON public.strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own strategies"
  ON public.strategies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own strategies"
  ON public.strategies FOR DELETE
  USING (auth.uid() = user_id);

-- Trades Policies
CREATE POLICY "Users can view own trades"
  ON public.trades FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trades"
  ON public.trades FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trades"
  ON public.trades FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trades"
  ON public.trades FOR DELETE
  USING (auth.uid() = user_id);

-- Daily Reviews Policies
CREATE POLICY "Users can view own reviews"
  ON public.daily_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reviews"
  ON public.daily_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.daily_reviews FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
  ON public.daily_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Automatic User Profile & Settings Trigger
-- Auto-populates profiles and user_settings when a user signs up through Supabase Auth
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_settings (user_id, starting_balance)
  VALUES (NEW.id, 25000.00);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
