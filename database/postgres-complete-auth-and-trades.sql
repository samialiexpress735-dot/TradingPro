-- ==============================================================================
-- TradePulse - Complete Standalone PostgreSQL Database Script
-- User Registration, Login History Tracking & Trade Execution Journal
-- ==============================================================================
-- Compatible with: Standard PostgreSQL 13+, Supabase SQL Editor, Neon, 
-- Cloud SQL, AWS RDS, and Local Docker PostgreSQL.
-- ==============================================================================

-- 1. Enable pgcrypto for secure cryptographic password hashing (bcrypt)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. Users Table (Core Registration & Credentials)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150),
    role VARCHAR(50) DEFAULT 'trader',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. User Login Sessions & Security Audit Table
-- Saves every login attempt (timestamp, IP address, device/browser, status)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    login_timestamp TIMESTAMPTZ DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    status VARCHAR(20) DEFAULT 'SUCCESS', -- 'SUCCESS', 'FAILED_PASSWORD', 'ACCOUNT_INACTIVE'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. User Trading Account Settings
-- ==============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    starting_balance NUMERIC(15, 2) DEFAULT 25000.00,
    currency VARCHAR(10) DEFAULT 'USD',
    default_risk_pct NUMERIC(5, 2) DEFAULT 1.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. Trades Table (Execution Journal linked to Registered Users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS trades (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time VARCHAR(10) DEFAULT '09:30',
    exit_date DATE,
    exit_time VARCHAR(10),
    symbol VARCHAR(20) NOT NULL,
    asset_class VARCHAR(20) NOT NULL, -- 'Stocks', 'Crypto', 'Forex', 'Futures', 'Options'
    direction VARCHAR(10) NOT NULL,   -- 'Long', 'Short'
    status VARCHAR(20) NOT NULL DEFAULT 'closed', -- 'closed', 'open'
    outcome VARCHAR(20) NOT NULL DEFAULT 'breakeven', -- 'win', 'loss', 'breakeven'
    entry_price NUMERIC(15, 4) NOT NULL,
    exit_price NUMERIC(15, 4) DEFAULT 0,
    quantity NUMERIC(15, 4) NOT NULL,
    stop_loss NUMERIC(15, 4) DEFAULT 0,
    take_profit NUMERIC(15, 4) DEFAULT 0,
    fees NUMERIC(10, 2) DEFAULT 0,
    gross_pnl NUMERIC(15, 2) DEFAULT 0,
    net_pnl NUMERIC(15, 2) DEFAULT 0,
    roi NUMERIC(8, 2) DEFAULT 0,
    planned_rr NUMERIC(8, 2) DEFAULT 0,
    realized_rr NUMERIC(8, 2) DEFAULT 0,
    strategy VARCHAR(100) DEFAULT 'Discretionary',
    rating SMALLINT DEFAULT 0,
    emotion VARCHAR(50) DEFAULT 'Disciplined',
    mistake VARCHAR(100),
    notes TEXT,
    chart_url TEXT,
    market_session VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_user_login_logs_user_id ON user_login_logs(user_id, login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(user_id, symbol);

-- ==============================================================================
-- 7. Stored Function: Register a New User
-- Securely hashes the password with bcrypt (gen_salt('bf', 10))
-- and initializes default account settings.
-- ==============================================================================
CREATE OR REPLACE FUNCTION sp_register_user(
    p_email VARCHAR(255),
    p_password VARCHAR(255),
    p_full_name VARCHAR(150) DEFAULT NULL,
    p_starting_balance NUMERIC DEFAULT 25000.00
)
RETURNS TABLE (
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(150),
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_user_id UUID;
    v_hashed_password VARCHAR(255);
BEGIN
    -- Check if email already exists
    IF EXISTS (SELECT 1 FROM users WHERE LOWER(users.email) = LOWER(p_email)) THEN
        RAISE EXCEPTION 'A user with email "%" already exists.', p_email;
    END IF;

    -- Hash password with bcrypt salt factor 10
    v_hashed_password := crypt(p_password, gen_salt('bf', 10));

    -- Insert new user
    INSERT INTO users (email, password_hash, full_name)
    VALUES (LOWER(TRIM(p_email)), v_hashed_password, p_full_name)
    RETURNING users.id INTO v_user_id;

    -- Create user initial settings
    INSERT INTO user_settings (user_id, starting_balance)
    VALUES (v_user_id, p_starting_balance);

    -- Log registration event
    INSERT INTO user_login_logs (user_id, email, ip_address, user_agent, status)
    VALUES (v_user_id, LOWER(TRIM(p_email)), '127.0.0.1', 'Registration', 'SUCCESS');

    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.created_at
    FROM users u
    WHERE u.id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 8. Stored Function: Authenticate User & Save Login Information
-- Validates password against bcrypt hash, updates last_login_at and login_count,
-- and records the login attempt in user_login_logs table.
-- ==============================================================================
CREATE OR REPLACE FUNCTION sp_login_user(
    p_email VARCHAR(255),
    p_password VARCHAR(255),
    p_ip_address VARCHAR(45) DEFAULT '127.0.0.1',
    p_user_agent TEXT DEFAULT 'Web Browser'
)
RETURNS TABLE (
    authenticated BOOLEAN,
    user_id UUID,
    email VARCHAR(255),
    full_name VARCHAR(150),
    last_login_at TIMESTAMPTZ,
    login_count INTEGER,
    message TEXT
) AS $$
DECLARE
    v_user users%ROWTYPE;
BEGIN
    -- Look up user by lowercase email
    SELECT * INTO v_user
    FROM users
    WHERE LOWER(users.email) = LOWER(TRIM(p_email));

    -- If user does not exist
    IF NOT FOUND THEN
        INSERT INTO user_login_logs (user_id, email, ip_address, user_agent, status)
        VALUES (NULL, LOWER(TRIM(p_email)), p_ip_address, p_user_agent, 'FAILED_USER_NOT_FOUND');

        RETURN QUERY SELECT FALSE, NULL::UUID, p_email, NULL::VARCHAR, NULL::TIMESTAMPTZ, 0, 'Invalid email or password'::TEXT;
        RETURN;
    END IF;

    -- Check if account is active
    IF NOT v_user.is_active THEN
        INSERT INTO user_login_logs (user_id, email, ip_address, user_agent, status)
        VALUES (v_user.id, v_user.email, p_ip_address, p_user_agent, 'ACCOUNT_SUSPENDED');

        RETURN QUERY SELECT FALSE, v_user.id, v_user.email, v_user.full_name, v_user.last_login_at, v_user.login_count, 'Account is suspended'::TEXT;
        RETURN;
    END IF;

    -- Verify password hash using crypt
    IF v_user.password_hash = crypt(p_password, v_user.password_hash) THEN
        -- Password match! Update user record
        UPDATE users
        SET last_login_at = NOW(),
            login_count = login_count + 1,
            updated_at = NOW()
        WHERE users.id = v_user.id;

        -- Record successful login in audit log
        INSERT INTO user_login_logs (user_id, email, ip_address, user_agent, status)
        VALUES (v_user.id, v_user.email, p_ip_address, p_user_agent, 'SUCCESS');

        RETURN QUERY 
        SELECT TRUE, v_user.id, v_user.email, v_user.full_name, NOW(), v_user.login_count + 1, 'Login successful'::TEXT;
    ELSE
        -- Password mismatch
        INSERT INTO user_login_logs (user_id, email, ip_address, user_agent, status)
        VALUES (v_user.id, v_user.email, p_ip_address, p_user_agent, 'FAILED_PASSWORD');

        RETURN QUERY SELECT FALSE, v_user.id, v_user.email, v_user.full_name, v_user.last_login_at, v_user.login_count, 'Invalid email or password'::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 9. Stored Function: Record Trade for Registered User
-- ==============================================================================
CREATE OR REPLACE FUNCTION sp_record_trade(
    p_user_id UUID,
    p_trade_id VARCHAR(64),
    p_date DATE,
    p_symbol VARCHAR(20),
    p_asset_class VARCHAR(20),
    p_direction VARCHAR(10),
    p_entry_price NUMERIC,
    p_exit_price NUMERIC,
    p_quantity NUMERIC,
    p_stop_loss NUMERIC DEFAULT 0,
    p_take_profit NUMERIC DEFAULT 0,
    p_fees NUMERIC DEFAULT 0,
    p_strategy VARCHAR(100) DEFAULT 'Discretionary',
    p_notes TEXT DEFAULT NULL
)
RETURNS VARCHAR(64) AS $$
DECLARE
    v_gross_pnl NUMERIC(15, 2);
    v_net_pnl NUMERIC(15, 2);
    v_roi NUMERIC(8, 2);
    v_outcome VARCHAR(20);
BEGIN
    -- Verify user exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'User ID "%" not found.', p_user_id;
    END IF;

    -- Calculate PnL
    IF LOWER(p_direction) = 'long' THEN
        v_gross_pnl := (p_exit_price - p_entry_price) * p_quantity;
    ELSE
        v_gross_pnl := (p_entry_price - p_exit_price) * p_quantity;
    END IF;

    v_net_pnl := v_gross_pnl - COALESCE(p_fees, 0);

    -- Calculate ROI %
    IF (p_entry_price * p_quantity) > 0 THEN
        v_roi := (v_net_pnl / (p_entry_price * p_quantity)) * 100;
    ELSE
        v_roi := 0;
    END IF;

    -- Determine outcome
    IF v_net_pnl > 0.01 THEN
        v_outcome := 'win';
    ELSIF v_net_pnl < -0.01 THEN
        v_outcome := 'loss';
    ELSE
        v_outcome := 'breakeven';
    END IF;

    -- Insert or update trade
    INSERT INTO trades (
        id, user_id, date, symbol, asset_class, direction,
        entry_price, exit_price, quantity, stop_loss, take_profit,
        fees, gross_pnl, net_pnl, roi, outcome, strategy, notes
    ) VALUES (
        p_trade_id, p_user_id, p_date, UPPER(p_symbol), p_asset_class, p_direction,
        p_entry_price, p_exit_price, p_quantity, p_stop_loss, p_take_profit,
        p_fees, v_gross_pnl, v_net_pnl, v_roi, v_outcome, p_strategy, p_notes
    )
    ON CONFLICT (id) DO UPDATE
    SET exit_price = EXCLUDED.exit_price,
        gross_pnl = EXCLUDED.gross_pnl,
        net_pnl = EXCLUDED.net_pnl,
        roi = EXCLUDED.roi,
        outcome = EXCLUDED.outcome,
        notes = EXCLUDED.notes;

    RETURN p_trade_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 10. Comprehensive View: Registered Users with Login Info & Taken Trades
-- ==============================================================================
CREATE OR REPLACE VIEW vw_user_trading_dashboard AS
SELECT
    u.id AS user_id,
    u.email,
    u.full_name,
    u.last_login_at,
    u.login_count,
    (
        SELECT l.ip_address
        FROM user_login_logs l
        WHERE l.user_id = u.id AND l.status = 'SUCCESS'
        ORDER BY l.login_timestamp DESC
        LIMIT 1
    ) AS last_login_ip,
    s.starting_balance,
    COUNT(t.id) AS total_trades_taken,
    COUNT(CASE WHEN t.outcome = 'win' THEN 1 END) AS wins,
    COUNT(CASE WHEN t.outcome = 'loss' THEN 1 END) AS losses,
    ROUND(
        CASE 
            WHEN COUNT(t.id) = 0 THEN 0.00
            ELSE (COUNT(CASE WHEN t.outcome = 'win' THEN 1 END)::NUMERIC / COUNT(t.id)::NUMERIC) * 100 
        END, 2
    ) AS win_rate_percentage,
    COALESCE(SUM(t.net_pnl), 0) AS total_realized_pnl,
    ROUND(COALESCE(s.starting_balance, 0) + COALESCE(SUM(t.net_pnl), 0), 2) AS current_account_equity
FROM users u
LEFT JOIN user_settings s ON u.id = s.user_id
LEFT JOIN trades t ON u.id = t.user_id
GROUP BY u.id, u.email, u.full_name, u.last_login_at, u.login_count, s.starting_balance;

-- ==============================================================================
-- 11. Concrete Test & Usage Examples
-- Run these queries to verify registration, login, and trade linkage!
-- ==============================================================================

/*
-- Step A: Register a new trader
SELECT * FROM sp_register_user(
    'alex.trader@example.com',
    'SecureTraderPassword123!',
    'Alex Rivers',
    50000.00
);

-- Step B: Log in the user (saves login info: IP, timestamp, device)
SELECT * FROM sp_login_user(
    'alex.trader@example.com',
    'SecureTraderPassword123!',
    '198.51.100.42',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0'
);

-- Step C: Take a winning trade for that user
-- (Replace USER_UUID with the user_id returned in Step A)
SELECT sp_record_trade(
    (SELECT id FROM users WHERE email = 'alex.trader@example.com'),
    'trade-nvda-001',
    CURRENT_DATE,
    'NVDA',
    'Stocks',
    'Long',
    124.50,
    132.80,
    100,
    121.00,
    135.00,
    2.50,
    'Opening Range Breakout',
    'Clean morning breakout above premarket high on 2.4x volume.'
);

-- Step D: Take a second trade for that user
SELECT sp_record_trade(
    (SELECT id FROM users WHERE email = 'alex.trader@example.com'),
    'trade-spy-002',
    CURRENT_DATE,
    'SPY',
    'Options',
    'Long',
    4.20,
    6.10,
    10,
    3.50,
    7.00,
    1.30,
    'VWAP Pullback Bounce',
    'Bounced off 15m VWAP with bullish engulfing signal.'
);

-- Step E: View the user profile, login information, and trading performance!
SELECT * FROM vw_user_trading_dashboard 
WHERE email = 'alex.trader@example.com';

-- Step F: View the login history logs for this trader
SELECT id, email, login_timestamp, ip_address, user_agent, status
FROM user_login_logs
WHERE email = 'alex.trader@example.com'
ORDER BY login_timestamp DESC;

-- Step G: Query all trades taken by this registered user
SELECT 
    t.id,
    t.date,
    t.symbol,
    t.direction,
    t.entry_price,
    t.exit_price,
    t.quantity,
    t.net_pnl,
    t.outcome,
    t.strategy
FROM trades t
JOIN users u ON t.user_id = u.id
WHERE u.email = 'alex.trader@example.com'
ORDER BY t.date DESC;
*/
