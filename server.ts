import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Ensure persistent data directory exists
const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path.resolve(DATA_DIR, 'tradepulse_db.json');

// Interface for persistent store
interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  createdAt: string;
  lastLoginAt: string;
}

interface PersistentUserSettings {
  startingBalance?: number;
  currency?: string;
  riskPct?: number;
  monthlyTargetAmount?: number;
  monthlyTargetType?: 'dollar' | 'percent';
  binanceApiKey?: string;
  capitalTransactions?: any[];
  googleSiteVerification?: string;
  adSensePublisherId?: string;
  adSenseSlotId?: string;
  adSenseAutoAds?: boolean;
  adSenseEnabled?: boolean;
  [key: string]: any;
}

interface PersistentDB {
  users: UserRecord[];
  userTrades: Record<string, any[]>;
  userStrategies: Record<string, any[]>;
  userReviews: Record<string, any[]>;
  userSettings: Record<string, PersistentUserSettings>;
  loginLogs: Record<string, Array<{ id: string; timestamp: string; userAgent: string; status: string }>>;
}

// Load or initialize DB
function loadDB(): PersistentDB {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || [],
        userTrades: parsed.userTrades || {},
        userStrategies: parsed.userStrategies || {},
        userReviews: parsed.userReviews || {},
        userSettings: parsed.userSettings || {},
        loginLogs: parsed.loginLogs || {},
      };
    }
  } catch (err) {
    console.error('Failed to read database file, initializing empty store:', err);
  }
  return {
    users: [],
    userTrades: {},
    userStrategies: {},
    userReviews: {},
    userSettings: {},
    loginLogs: {},
  };
}

let db: PersistentDB = loadDB();

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write database file:', err);
  }
}

// Password hashing helper (SHA256 + salt)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + '_tradepulse_salt_2025').digest('hex');
}

// Fallback in-memory ticket store
let supportTicketsStore: any[] = [];

// Initialize Gemini SDK if API key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI();
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
  }
}

// -------------------------------------------------------------
// Authentication & Multi-Device SaaS Sync Endpoints
// -------------------------------------------------------------

// POST /api/auth/signup - Register new account
app.post('/api/auth/signup', (req: Request, res: Response) => {
  const { email, password, fullName } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  // Check if user already exists
  const existingUser = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
  }

  // Generate unique User UUID
  const userId = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  const newUser: UserRecord = {
    id: userId,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    fullName: fullName?.trim() || normalizedEmail.split('@')[0],
    createdAt: now,
    lastLoginAt: now,
  };

  db.users.push(newUser);
  db.userTrades[userId] = [];
  db.userStrategies[userId] = [];
  db.userReviews[userId] = [];
  db.userSettings[userId] = {
    startingBalance: 25000,
    currency: 'USD',
    riskPct: 1.0,
  };

  // Record audit log
  const userAgent = req.headers['user-agent'] || 'Web Browser';
  if (!db.loginLogs[userId]) db.loginLogs[userId] = [];
  db.loginLogs[userId].unshift({
    id: `log_${Date.now()}`,
    timestamp: now,
    userAgent,
    status: 'SUCCESS',
  });

  saveDB();

  const safeUser = {
    id: userId,
    email: newUser.email,
    user_metadata: {
      full_name: newUser.fullName,
    },
    created_at: newUser.createdAt,
  };

  res.status(201).json({
    success: true,
    user: safeUser,
    token: `tkn_${Buffer.from(userId + ':' + Date.now()).toString('base64')}`,
  });
});

// POST /api/auth/signin - Sign in to existing account
app.post('/api/auth/signin', (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password. Please try again.' });
  }

  const now = new Date().toISOString();
  user.lastLoginAt = now;

  // Record login log
  const userAgent = req.headers['user-agent'] || 'Web Browser';
  if (!db.loginLogs[user.id]) db.loginLogs[user.id] = [];
  db.loginLogs[user.id].unshift({
    id: `log_${Date.now()}`,
    timestamp: now,
    userAgent,
    status: 'SUCCESS',
  });
  // Keep last 25 logins
  if (db.loginLogs[user.id].length > 25) {
    db.loginLogs[user.id] = db.loginLogs[user.id].slice(0, 25);
  }

  saveDB();

  const safeUser = {
    id: user.id,
    email: user.email,
    user_metadata: {
      full_name: user.fullName,
    },
    created_at: user.createdAt,
  };

  res.json({
    success: true,
    user: safeUser,
    token: `tkn_${Buffer.from(user.id + ':' + Date.now()).toString('base64')}`,
  });
});

// Helper to extract userId from headers or query
function getUserIdFromReq(req: Request): string | null {
  const queryUserId = req.query.userId as string;
  if (queryUserId) return queryUserId;

  const headerUserId = req.headers['x-user-id'] as string;
  if (headerUserId) return headerUserId;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer tkn_')) {
    try {
      const decoded = Buffer.from(authHeader.replace('Bearer tkn_', ''), 'base64').toString('utf-8');
      const parts = decoded.split(':');
      if (parts[0]) return parts[0];
    } catch {}
  }
  return null;
}

// GET /api/user/trades - Get trades for authenticated user
app.get('/api/user/trades', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  const userTrades = db.userTrades[userId] || [];
  res.json({
    success: true,
    count: userTrades.length,
    trades: userTrades,
  });
});

// POST /api/user/trades - Upsert single trade for user
app.post('/api/user/trades', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req) || req.body.userId;
  const trade = req.body.trade || req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }
  if (!trade || !trade.symbol) {
    return res.status(400).json({ error: 'Valid trade object required' });
  }

  if (!db.userTrades[userId]) {
    db.userTrades[userId] = [];
  }

  const existingIdx = db.userTrades[userId].findIndex((t) => t.id === trade.id);
  if (existingIdx >= 0) {
    db.userTrades[userId][existingIdx] = trade;
  } else {
    db.userTrades[userId].unshift(trade);
  }

  saveDB();
  res.json({ success: true, trade });
});

// DELETE /api/user/trades/:id - Delete single trade for user
app.delete('/api/user/trades/:id', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const tradeId = req.params.id;

  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  if (db.userTrades[userId]) {
    db.userTrades[userId] = db.userTrades[userId].filter((t) => t.id !== tradeId);
    saveDB();
  }

  res.json({ success: true, message: `Trade ${tradeId} deleted` });
});

// POST /api/user/trades/sync - Bulk batch sync trades for user
app.post('/api/user/trades/sync', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req) || req.body.userId;
  const trades = req.body.trades;

  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }
  if (!Array.isArray(trades)) {
    return res.status(400).json({ error: 'trades must be an array' });
  }

  db.userTrades[userId] = trades;
  saveDB();

  res.json({ success: true, count: trades.length });
});

// GET /api/user/settings - Get settings for user
app.get('/api/user/settings', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  const settings = db.userSettings[userId] || {
    startingBalance: 25000,
    currency: 'USD',
    riskPct: 1.0,
    googleSiteVerification: '5mo-v_3ysJIX1CEAvNmxD9xaAkMawkK9nwMQ-2O0p2o',
    adSensePublisherId: 'pub-1549023438906458',
    adSenseEnabled: true,
  };
  res.json({ success: true, settings });
});

// POST /api/user/settings - Update settings for user
app.post('/api/user/settings', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req) || req.body.userId;
  const settings = req.body.settings || req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  db.userSettings[userId] = {
    ...db.userSettings[userId],
    ...settings,
  };
  saveDB();

  res.json({ success: true, settings: db.userSettings[userId] });
});

// GET /api/user/strategies - Get strategies for user
app.get('/api/user/strategies', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  const strategies = db.userStrategies[userId] || [];
  res.json({ success: true, strategies });
});

// POST /api/user/strategies - Upsert strategy for user
app.post('/api/user/strategies', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req) || req.body.userId;
  const strategy = req.body.strategy || req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  if (!db.userStrategies[userId]) {
    db.userStrategies[userId] = [];
  }

  const idx = db.userStrategies[userId].findIndex((s) => s.id === strategy.id);
  if (idx >= 0) {
    db.userStrategies[userId][idx] = strategy;
  } else {
    db.userStrategies[userId].push(strategy);
  }
  saveDB();

  res.json({ success: true, strategy });
});

// GET /api/user/logins - Get user login history
app.get('/api/user/logins', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  if (!userId) {
    return res.status(400).json({ error: 'User identifier required' });
  }

  const logs = db.loginLogs[userId] || [];
  res.json({ success: true, logs });
});

// -------------------------------------------------------------
// Legacy & Global API Routes (Backward-compatible)
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TradePulse Production API',
    version: '1.2.0',
    totalRegisteredUsers: db.users.length,
    hasGeminiSupport: !!process.env.GEMINI_API_KEY,
  });
});

// GET /ads.txt - Google AdSense Authorized Digital Sellers verification
app.get('/ads.txt', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  let pubId = '';

  // 1. Try requested user if authenticated
  if (userId && db.userSettings[userId]?.adSensePublisherId) {
    pubId = db.userSettings[userId].adSensePublisherId;
  }
  // 2. Check default guest
  else if (db.userSettings['default_guest']?.adSensePublisherId) {
    pubId = db.userSettings['default_guest'].adSensePublisherId;
  }
  // 3. Search across all accounts for the configured AdSense publisher ID (for Googlebot crawlers)
  else {
    for (const u of Object.keys(db.userSettings)) {
      if (db.userSettings[u]?.adSensePublisherId) {
        pubId = db.userSettings[u].adSensePublisherId;
        break;
      }
    }
  }

  // Clean publisher ID (ensure pub- format without ca-)
  let cleanPub = (pubId || 'pub-1549023438906458').trim();
  if (cleanPub.startsWith('ca-')) {
    cleanPub = cleanPub.replace('ca-', '');
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(`google.com, ${cleanPub}, DIRECT, f08c47fec0942fa0\n`);
});

// GET /sitemap.xml & /sitemaps.xml - XML Sitemap for Google Search Console
app.get(['/sitemap.xml', '/sitemaps.xml'], (req: Request, res: Response) => {
  const host = req.get('host') || 'tradepulse.io';
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const baseUrl = `${protocol}://${host}`;
  const today = new Date().toISOString().split('T')[0];

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/#dashboard</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/#news</loc>
    <lastmod>${today}</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/#calculator</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/#playbook</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/#analytics</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(sitemapXml);
});

// GET /api/trades - List trades (global fallback)
app.get('/api/trades', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const tradesStore = userId && db.userTrades[userId] ? db.userTrades[userId] : [];
  const { symbol, assetClass, outcome, strategy } = req.query;

  let filtered = [...tradesStore];
  if (symbol) {
    filtered = filtered.filter((t) => t.symbol?.toUpperCase() === String(symbol).toUpperCase());
  }
  if (assetClass) {
    filtered = filtered.filter((t) => t.assetClass === assetClass);
  }
  if (outcome) {
    filtered = filtered.filter((t) => t.outcome === outcome);
  }
  if (strategy) {
    filtered = filtered.filter((t) => t.strategy === strategy);
  }

  res.json({
    success: true,
    count: filtered.length,
    trades: filtered,
  });
});

// POST /api/trades - Create trade (global fallback)
app.post('/api/trades', (req: Request, res: Response) => {
  const newTrade = req.body;
  const userId = getUserIdFromReq(req) || req.body.userId;

  if (!newTrade.symbol || !newTrade.entryPrice || !newTrade.quantity) {
    return res.status(400).json({ error: 'symbol, entryPrice, and quantity are required.' });
  }

  const tradeWithId = {
    ...newTrade,
    id: newTrade.id || `tr-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  if (userId) {
    if (!db.userTrades[userId]) db.userTrades[userId] = [];
    db.userTrades[userId].unshift(tradeWithId);
    saveDB();
  }

  res.status(201).json({ success: true, trade: tradeWithId });
});

// POST /api/trades/sync - Bulk sync (global fallback)
app.post('/api/trades/sync', (req: Request, res: Response) => {
  const { trades, userId } = req.body;
  if (!Array.isArray(trades)) {
    return res.status(400).json({ error: 'trades must be an array' });
  }

  if (userId) {
    db.userTrades[userId] = trades;
    saveDB();
  }

  res.json({ success: true, count: trades.length });
});

// GET /api/analytics - Aggregate calculations
app.get('/api/analytics', (req: Request, res: Response) => {
  const userId = getUserIdFromReq(req);
  const tradesStore = userId && db.userTrades[userId] ? db.userTrades[userId] : [];

  const closed = tradesStore.filter((t) => t.status === 'closed');
  const wins = closed.filter((t) => t.outcome === 'win');
  const losses = closed.filter((t) => t.outcome === 'loss');

  const grossProfit = wins.reduce((sum, t) => sum + (t.netPnl || 0), 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(t.netPnl || 0), 0);
  const netProfit = Number((grossProfit - grossLoss).toFixed(2));
  const winRate = closed.length > 0 ? Number(((wins.length / closed.length) * 100).toFixed(1)) : 0;
  const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99 : 0;
  const avgWin = wins.length > 0 ? Number((grossProfit / wins.length).toFixed(2)) : 0;
  const avgLoss = losses.length > 0 ? Number((grossLoss / losses.length).toFixed(2)) : 0;

  res.json({
    success: true,
    stats: {
      totalTrades: tradesStore.length,
      closedTrades: closed.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      netProfit,
      profitFactor,
      averageWin: avgWin,
      averageLoss: avgLoss,
      expectancy: Number(((winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss).toFixed(2)),
    },
  });
});

// POST /api/risk-calc - Server position size calculator
app.post('/api/risk-calc', (req: Request, res: Response) => {
  const { accountBalance, riskPercentage, entryPrice, stopLossPrice, targetPrice, leverage = 1 } = req.body;

  if (!accountBalance || !riskPercentage || !entryPrice || !stopLossPrice) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  const riskAmount = Number(((accountBalance * (riskPercentage / 100))).toFixed(2));
  const priceRiskPerUnit = Math.abs(entryPrice - stopLossPrice);

  if (priceRiskPerUnit === 0) {
    return res.status(400).json({ error: 'Entry and stop loss cannot be identical.' });
  }

  const rawSize = riskAmount / priceRiskPerUnit;
  const positionSize = Math.floor(rawSize);
  const positionValue = Number((positionSize * entryPrice).toFixed(2));
  const marginRequired = Number((positionValue / leverage).toFixed(2));

  let rewardToRisk = 0;
  let targetProfit = 0;
  if (targetPrice) {
    const rewardPerUnit = Math.abs(targetPrice - entryPrice);
    rewardToRisk = Number((rewardPerUnit / priceRiskPerUnit).toFixed(2));
    targetProfit = Number((rewardPerUnit * positionSize).toFixed(2));
  }

  res.json({
    success: true,
    riskAmount,
    positionSize,
    positionValue,
    marginRequired,
    rewardToRisk,
    targetProfit,
    isOverLeveraged: marginRequired > accountBalance,
  });
});

// In-memory cache for Binance market pulse (15s TTL)
let cachedPulseData: any = null;
let lastPulseFetchTime = 0;

// GET /api/binance/market-pulse - Real-time Binance Perpetual Tickers & Session Clock
app.get('/api/binance/market-pulse', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cachedPulseData && now - lastPulseFetchTime < 15000) {
    return res.json(cachedPulseData);
  }

  // Calculate current global session clock (UTC)
  const utcDate = new Date();
  const utcHours = utcDate.getUTCHours();
  const utcMinutes = utcDate.getUTCMinutes();
  const currentTotalMins = utcHours * 60 + utcMinutes;

  interface TradingSession {
    name: string;
    code: string;
    status: 'ACTIVE' | 'UPCOMING' | 'CLOSED';
    timeframe: string;
    volatility: 'HIGH' | 'MEDIUM' | 'MODERATE';
    note: string;
    minsRemaining?: number;
  }

  // Asian: 00:00 to 09:00 (0 to 540)
  // London: 07:00 to 15:30 (420 to 930)
  // New York: 13:30 to 20:00 (810 to 1200)
  // NY AM Killzone: 13:30 to 16:30 (810 to 990)
  // London Close: 15:00 to 16:30 (900 to 990)

  let activeSessionName = 'Tokyo / Asian Session';
  let activeKillZone = 'Standard Asian Range';
  let sessionStateNote = 'Asian range consolidation; monitor key highs and lows for London sweeps.';
  let isOverlap = false;

  // 12:00 to 15:30 UTC = London & NY overlap (peak daily volume)
  if (currentTotalMins >= 720 && currentTotalMins < 930) {
    activeSessionName = 'London / New York Overlap';
    activeKillZone = currentTotalMins >= 810 ? '🔥 NY AM Peak Volume Killzone' : '⚡ London & NY Overlap';
    sessionStateNote = 'Maximum global liquidity. Institutional order blocks, highest daily volatility.';
    isOverlap = true;
  }
  // 15:30 to 16:30 UTC = London Close & NY AM
  else if (currentTotalMins >= 930 && currentTotalMins < 990) {
    activeSessionName = 'London Close / NY Session';
    activeKillZone = '⚡ London Fixing / Close';
    sessionStateNote = 'European traders square daily books; institutional rebalancing flows.';
  }
  // 16:30 to 18:30 UTC = NY Mid-Day
  else if (currentTotalMins >= 990 && currentTotalMins < 1110) {
    activeSessionName = 'New York Mid-Day';
    activeKillZone = 'NY Lunch Consolidation';
    sessionStateNote = 'Volume thins out during NY lunch. Beware chop and false breakouts.';
  }
  // 18:30 to 20:00 UTC = NY Power Hour (14:30 - 16:00 EST)
  else if (currentTotalMins >= 1110 && currentTotalMins < 1200) {
    activeSessionName = 'New York PM Session';
    activeKillZone = '⚡ Power Hour / Cash Close';
    sessionStateNote = 'Heavy volume into market on-close imbalances (MOC). Trend continuations.';
  }
  // 20:00 to 22:00 UTC = After Hours / Pacific Pre-Market
  else if (currentTotalMins >= 1200 && currentTotalMins < 1320) {
    activeSessionName = 'After-Hours / Pacific Open';
    activeKillZone = 'Sydney Opening Session';
    sessionStateNote = 'Australian/NZ liquidity entering. Crypto and forex transition.';
  }
  // 22:00 to 00:00 UTC = Sydney Session
  else if (currentTotalMins >= 1320 || currentTotalMins < 0) {
    activeSessionName = 'Sydney / Asian Pre-Market';
    activeKillZone = 'Sydney Active Session';
    sessionStateNote = 'Pacing picks up as Tokyo interbank desks prepare for 00:00 UTC open.';
  }
  // 00:00 to 07:00 UTC = Tokyo / Asian Session
  else if (currentTotalMins >= 0 && currentTotalMins < 420) {
    activeSessionName = 'Tokyo / Asian Session';
    activeKillZone = currentTotalMins < 120 ? '⚡ Tokyo Open Killzone' : 'Standard Asian Range';
    sessionStateNote = 'Consolidation and range-building; ideal for defining liquidity sweeps.';
  }
  // 07:00 to 12:00 UTC = London Morning Session (08:00 - 13:00 London time)
  else if (currentTotalMins >= 420 && currentTotalMins < 720) {
    activeSessionName = 'London Morning Session';
    activeKillZone = currentTotalMins < 600 ? '⚡ London Open Killzone' : 'London European Mid-Day';
    sessionStateNote = 'High expansion volatility. Frequently triggers breakout rallies or liquidity runs.';
  }

  const sessionClock = {
    utcTime: utcDate.toISOString().replace('T', ' ').substring(11, 19) + ' UTC',
    activeSession: activeSessionName,
    activeKillZone,
    sessionStateNote,
    isOverlap,
  };

  const symbolsToTrack = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];

  try {
    const symbolsParam = encodeURIComponent(JSON.stringify(symbolsToTrack));
    const [tickerRes, fundingRes] = await Promise.allSettled([
      fetch(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbols=${symbolsParam}`, { signal: AbortSignal.timeout(3500) }),
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex`, { signal: AbortSignal.timeout(3500) }),
    ]);

    let tickers: any[] = [];
    let fundings: Record<string, { lastFundingRate: number; nextFundingTime: number }> = {};

    if (tickerRes.status === 'fulfilled' && tickerRes.value.ok) {
      tickers = await tickerRes.value.json();
    }

    if (fundingRes.status === 'fulfilled' && fundingRes.value.ok) {
      const fundingList = await fundingRes.value.json();
      if (Array.isArray(fundingList)) {
        fundingList.forEach((f: any) => {
          if (symbolsToTrack.includes(f.symbol)) {
            fundings[f.symbol] = {
              lastFundingRate: parseFloat(f.lastFundingRate) || 0,
              nextFundingTime: f.nextFundingTime || 0,
            };
          }
        });
      }
    }

    if (Array.isArray(tickers) && tickers.length > 0) {
      const processedTickers = tickers.map((t: any) => {
        const symbolDisplay = `${t.symbol}.P`;
        const lastPrice = parseFloat(t.lastPrice) || 0;
        const priceChangePercent = parseFloat(t.priceChangePercent) || 0;
        const highPrice = parseFloat(t.highPrice) || 0;
        const lowPrice = parseFloat(t.lowPrice) || 0;
        const volume24hUsdt = (parseFloat(t.quoteVolume) || 0) / 1000000; // in Millions USDT
        const funding = fundings[t.symbol] || { lastFundingRate: 0.0001, nextFundingTime: Date.now() + 3600000 };
        const fundingPct = Number((funding.lastFundingRate * 100).toFixed(4));

        return {
          symbol: symbolDisplay,
          baseSymbol: t.symbol,
          lastPrice,
          priceChangePercent,
          highPrice,
          lowPrice,
          volume24hUsdt: Number(volume24hUsdt.toFixed(1)),
          fundingRatePct: fundingPct,
          isHighFunding: Math.abs(fundingPct) >= 0.03,
          bias: priceChangePercent >= 0 ? 'BULLISH' : 'BEARISH',
        };
      });

      cachedPulseData = {
        success: true,
        source: 'binance-fapi-live',
        updatedAt: new Date().toISOString(),
        sessionClock,
        tickers: processedTickers,
      };
      lastPulseFetchTime = now;
      return res.json(cachedPulseData);
    }
  } catch (err: any) {
    console.warn('Could not fetch Binance live ticker, using institutional reference fallback:', err?.message || err);
  }

  // Graceful fallback reference data if Binance API is unreachable or rate limited
  const fallbackTickers = [
    { symbol: 'BTCUSDT.P', baseSymbol: 'BTCUSDT', lastPrice: 80735.0, priceChangePercent: 2.45, highPrice: 81400.0, lowPrice: 78900.0, volume24hUsdt: 4210.5, fundingRatePct: 0.0100, isHighFunding: false, bias: 'BULLISH' },
    { symbol: 'ETHUSDT.P', baseSymbol: 'ETHUSDT', lastPrice: 2840.5, priceChangePercent: 3.12, highPrice: 2890.0, lowPrice: 2750.0, volume24hUsdt: 1850.2, fundingRatePct: 0.0095, isHighFunding: false, bias: 'BULLISH' },
    { symbol: 'SOLUSDT.P', baseSymbol: 'SOLUSDT', lastPrice: 188.75, priceChangePercent: 4.80, highPrice: 192.50, lowPrice: 179.80, volume24hUsdt: 980.4, fundingRatePct: 0.0150, isHighFunding: false, bias: 'BULLISH' },
    { symbol: 'BNBUSDT.P', baseSymbol: 'BNBUSDT', lastPrice: 622.3, priceChangePercent: 1.15, highPrice: 630.0, lowPrice: 615.0, volume24hUsdt: 340.8, fundingRatePct: 0.0100, isHighFunding: false, bias: 'BULLISH' },
    { symbol: 'DOGEUSDT.P', baseSymbol: 'DOGEUSDT', lastPrice: 0.1685, priceChangePercent: -1.20, highPrice: 0.1740, lowPrice: 0.1650, volume24hUsdt: 520.1, fundingRatePct: 0.0080, isHighFunding: false, bias: 'BEARISH' },
    { symbol: 'XRPUSDT.P', baseSymbol: 'XRPUSDT', lastPrice: 0.5820, priceChangePercent: 0.85, highPrice: 0.5910, lowPrice: 0.5740, volume24hUsdt: 410.6, fundingRatePct: 0.0100, isHighFunding: false, bias: 'BULLISH' },
  ];

  cachedPulseData = {
    success: true,
    source: 'tradepulse-reference-engine',
    updatedAt: new Date().toISOString(),
    sessionClock,
    tickers: fallbackTickers,
  };
  lastPulseFetchTime = now;
  return res.json(cachedPulseData);
});

// -------------------------------------------------------------
// GET /api/news/feed - Continuous Real-Time Live Financial News & Catalyst Feed
// -------------------------------------------------------------
let cachedLiveNewsCatalysts: any[] = [];
let lastNewsFetchTimestamp = 0;
const NEWS_CACHE_TTL_MS = 45000; // 45s cache to ensure freshness and high performance

function unescapeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8211;/g, '-')
    .replace(/&#8212;/g, '--');
}

function calculateRelativeTime(dateStr: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diffMs / (60 * 1000));
  if (mins < 1) return 'Just now';
  if (mins === 1) return '1m ago';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1h ago';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Stable short hash so the same headline keeps the same id between refreshes
// (the UI uses ids to detect "new" headlines and to keep cards expanded).
function stableHash(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

async function fetchRealTimeLiveNews(): Promise<any[]> {
  const feeds = [
    {
      url: 'https://news.google.com/rss/search?q=crypto+OR+bitcoin+OR+ethereum+OR+binance+when:2d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'crypto',
    },
    {
      url: 'https://news.google.com/rss/search?q=%22stock+market%22+OR+Nasdaq+OR+%22S%26P+500%22+OR+%22Wall+Street%22+when:2d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'equities',
    },
    {
      url: 'https://news.google.com/rss/search?q=%22Federal+Reserve%22+OR+inflation+OR+%22interest+rates%22+OR+CPI+when:3d&hl=en-US&gl=US&ceid=US:en',
      defaultCategory: 'macro',
    },
    {
      url: 'https://cointelegraph.com/rss',
      defaultCategory: 'crypto',
    },
  ];

  try {
    const feedResults = await Promise.allSettled(
      feeds.map((f) =>
        fetch(f.url, {
          signal: AbortSignal.timeout(4500),
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        }).then((r) => r.text())
      )
    );

    const parsedArticles: any[] = [];
    const seenHeadlines = new Set<string>();

    feedResults.forEach((res, feedIdx) => {
      if (res.status !== 'fulfilled' || !res.value) return;
      const xml = res.value;
      const defaultCategory = feeds[feedIdx].defaultCategory;

      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      let countFromFeed = 0;

      while ((match = itemRegex.exec(xml)) !== null && countFromFeed < 12) {
        const itemContent = match[1];
        const titleMatch = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(itemContent);
        const linkMatch = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/.exec(itemContent);
        const pubDateMatch = /<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/.exec(itemContent);
        const sourceMatch = /<source[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/source>/.exec(itemContent);
        const descMatch = /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/.exec(itemContent);

        if (!titleMatch) continue;

        let rawTitle = unescapeHtmlEntities(titleMatch[1].trim());
        let sourceName = sourceMatch ? unescapeHtmlEntities(sourceMatch[1].trim()) : '';

        if (!sourceName && rawTitle.includes(' - ')) {
          const parts = rawTitle.split(' - ');
          sourceName = parts[parts.length - 1].trim();
          rawTitle = parts.slice(0, -1).join(' - ').trim();
        } else if (rawTitle.includes(' - ') && sourceName) {
          rawTitle = rawTitle.substring(0, rawTitle.lastIndexOf(' - ')).trim();
        }

        if (!sourceName) sourceName = defaultCategory === 'crypto' ? 'Crypto Wire' : 'Financial Markets Wire';

        // Filter out empty or placeholder/meta strings
        if (!rawTitle || rawTitle.includes('META_TITLE') || rawTitle.length < 15) continue;

        const normalizedHeadline = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenHeadlines.has(normalizedHeadline)) continue;
        seenHeadlines.add(normalizedHeadline);

        const pubDateStr = pubDateMatch ? pubDateMatch[1].trim() : new Date().toUTCString();
        const articleDate = new Date(pubDateStr);
        const timestamp = isNaN(articleDate.getTime()) ? new Date().toISOString() : articleDate.toISOString();

        // Categorize
        const lower = rawTitle.toLowerCase();
        let category: 'crypto' | 'macro' | 'equities' | 'forex' = defaultCategory as any;
        // Whole-word matching only: substring matching wrongly tagged e.g. "whether" as ETH,
        // "said" as AI and "second" as SEC.
        if (/\b(bitcoin|btc|eth|ethereum|crypto|binance|solana|altcoin|blockchain|tokens?|stablecoins?|coindesk|cointelegraph)\b/.test(lower)) {
          category = 'crypto';
        } else if (/\b(fed|federal reserve|powell|inflation|cpi|ppi|interest rates?|rate (cuts?|hikes?)|gdp|central bank|treasury|yields?)\b/.test(lower)) {
          category = 'macro';
        } else if (/\b(dollar|dxy|eurusd|usdjpy|gbpusd|forex|currency|currencies)\b/.test(lower)) {
          category = 'forex';
        } else if (/\b(stocks?|nasdaq|s&p|dow|shares|earnings|ai|chips?|tech|wall street|nvidia|nvda|tesla|tsla|apple|aapl)\b/.test(lower)) {
          category = 'equities';
        }

        // Affected Symbols
        const symbols: string[] = [];
        if (/\b(bitcoin|btc)\b/.test(lower)) symbols.push('BTCUSDT.P');
        if (/\b(ethereum|eth)\b/.test(lower)) symbols.push('ETHUSDT.P');
        if (/\b(solana|sol)\b/.test(lower)) symbols.push('SOLUSDT.P');
        if (/\b(binance|bnb)\b/.test(lower)) symbols.push('BNBUSDT.P');
        if (/\b(nvidia|nvda|chips?|gpus?|semiconductors?)\b/.test(lower)) symbols.push('NVDA');
        if (/\b(tesla|tsla|evs?)\b/.test(lower)) symbols.push('TSLA');
        if (/\b(apple|aapl)\b/.test(lower)) symbols.push('AAPL');
        if (/\b(microsoft|msft)\b/.test(lower)) symbols.push('MSFT');
        if (/\bamd\b/.test(lower)) symbols.push('AMD');
        if (/\b(nasdaq|tech)\b/.test(lower)) symbols.push('QQQ');
        if (/\b(s&p|stock market|wall street)\b/.test(lower)) symbols.push('SPY');
        if (/\b(dollar|yields?|rates?|fed)\b/.test(lower)) symbols.push('DXY');
        if (/\b(euro|eur)\b/.test(lower)) symbols.push('EURUSD');

        if (symbols.length === 0) {
          if (category === 'crypto') symbols.push('BTCUSDT.P', 'ETHUSDT.P');
          else if (category === 'macro') symbols.push('SPY', 'QQQ', 'DXY');
          else if (category === 'forex') symbols.push('DXY', 'EURUSD');
          else symbols.push('SPY', 'QQQ', 'NVDA');
        }

        // Sentiment
        let sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE_CHOP' | 'NEUTRAL' = 'NEUTRAL';
        // Generic words like "high", "cut" and "support" were removed: "inflation stays high" and
        // "job cuts" are bearish, so they made the tag wrong as often as right.
        const isBullish = /\b(rall(y|ies|ied)|surg(e|es|ed)|soar(s|ed)?|jump(s|ed)?|gain(s|ed)?|bounc(e|es|ed)|climb(s|ed)?|bullish|rises?|risen|rose|record high|recover(y|s|ed)?|stabili[sz](e|es|ed))\b/.test(lower);
        const isBearish = /\b(plung(e|es|ed)|drop(s|ped)?|slump(s|ed)?|fall(s|en)?|fell|sink(s)?|sank|slid(e|es)|rout|bloodbath|crash(es|ed)?|sell-?off|fear|bearish|loss(es)?|hack(s|ed)?|lawsuit|probe|down|crackdown|panic|tumbl(e|es|ed))\b/.test(lower);
        const isVolatile = /\b(whipsaw(s|ed)?|paus(e|es|ed)|mixed|wobbl(e|es|ed)|volatile|volatility|uncertain(ty)?|swings?|divided?|rebound(s|ed)?|tensions?)\b/.test(lower);

        if (isBullish && !isBearish) sentiment = 'BULLISH';
        else if (isBearish && !isBullish) sentiment = 'BEARISH';
        else if (isVolatile || (isBullish && isBearish)) sentiment = 'VOLATILE_CHOP';
        else sentiment = 'NEUTRAL';

        // Impact level
        let impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
        if (/\b(hack(s|ed)?|crash(es|ed)?|plung(e|es|ed)|fed|federal reserve|inflation|cpi|rate (cuts?|hikes?)|rout|bloodbath|bans?|banned|sec|investigation)\b/.test(lower)) {
          impactLevel = 'HIGH';
        } else if (/\b(shares|earnings|meeting|analysts?|forecasts?|review)\b/.test(lower)) {
          impactLevel = 'LOW';
        }

        // Dynamic Tactical Advice & Actionable Trading Plan
        let recommendedAction = '';
        let stopLossGuidance = '';
        let bestSetup = '';
        let volatilityWarning = '';
        let tradingTakeaway = '';

        if (sentiment === 'BULLISH') {
          tradingTakeaway = `Headline from ${sourceName} reads bullish (keyword-based tag). If price confirms, dip buyers typically defend VWAP and nearby support.`;
          recommendedAction = `Look for long continuation setups on 5m/15m retests of structural support or VWAP. Avoid chasing extended green candles.`;
          stopLossGuidance = `Place stop loss strictly behind the session breakout anchor or lower 15-minute swing low.`;
          bestSetup = `Opening Range Breakout (ORB) retest or high-volume pullback to VWAP.`;
          volatilityWarning = `Monitor funding rates and open interest spikes; watch out for mean-reversion pullbacks at major daily resistance.`;
        } else if (sentiment === 'BEARISH') {
          tradingTakeaway = `Headline from ${sourceName} reads bearish (keyword-based tag). If price confirms, expect risk-off flows and weaker bounces.`;
          recommendedAction = `Protect open profits by tightening trailing stops. Avoid front-running knife catches until a clear bullish market structure shift (MSS) occurs.`;
          stopLossGuidance = `Keep stop loss tight above intraday lower-high rejections; do not widen stops during adverse volatility.`;
          bestSetup = `Bearish breakdown retest of broken support flipped into resistance, or fade of weak relief bounces.`;
          volatilityWarning = `Cascade liquidation and slippage risk elevated during active flush cycles. Cut position leverage.`;
        } else if (sentiment === 'VOLATILE_CHOP') {
          tradingTakeaway = `Headline from ${sourceName} signals mixed or uncertain conditions (keyword-based tag). Two-sided, choppy price action is possible.`;
          recommendedAction = `Reduce position sizing by 50% or wait on sidelines for directional resolution above or below the opening range.`;
          stopLossGuidance = `Widen stop loss beyond local swing extremes or wait for confirmation closes outside the chop zone.`;
          bestSetup = `Range-bound liquidity sweep fade: buy the false breakdown at range low, sell the false breakout at range high.`;
          volatilityWarning = `False breakouts and stop hunts are frequent in chop environments. Never chase breakouts without high relative volume (RVOL).`;
        } else {
          tradingTakeaway = `No clear directional signal in this ${sourceName} headline (keyword-based tag). Treat it as background context.`;
          recommendedAction = `Trade standard technical setups (Order Blocks, FVG, VWAP) adhering strictly to defined risk parameters.`;
          stopLossGuidance = `Standard 1% to 1.5% fixed trade risk stop loss.`;
          bestSetup = `Standard trend-following pullback entry on confirmed momentum.`;
          volatilityWarning = `Watch for unexpected breaking headlines into session close or killzone transitions.`;
        }

        let summaryText = '';
        if (descMatch && descMatch[1]) {
          summaryText = unescapeHtmlEntities(descMatch[1].replace(/<[^>]*>/g, '').trim());
          if (summaryText.length > 250) summaryText = summaryText.substring(0, 247) + '...';
        }
        if (!summaryText || summaryText.length < 20) {
          summaryText = `${sourceName} reports: ${rawTitle}.`;
        }

        parsedArticles.push({
          id: `live-${stableHash(normalizedHeadline)}`,
          headline: rawTitle,
          source: sourceName,
          link: linkMatch ? linkMatch[1].trim() : '',
          timestamp,
          timeAgo: calculateRelativeTime(timestamp),
          category,
          impactLevel,
          sentiment,
          affectedSymbols: symbols,
          summary: summaryText,
          tradingTakeaway,
          tacticalAdvice: {
            recommendedAction,
            stopLossGuidance,
            bestSetup,
            volatilityWarning,
          },
        });

        countFromFeed++;
      }
    });

    if (parsedArticles.length > 0) {
      // Sort newest first
      parsedArticles.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return parsedArticles;
    }
  } catch (err) {
    console.warn('Real-time live news fetch error, using resilient cache/backup:', err);
  }

  return [];
}

app.get('/api/news/feed', async (req: Request, res: Response) => {
  const now = Date.now();
  const categoryFilter = req.query.category as string | undefined;

  // Refresh live feed if cache is expired or empty
  if (now - lastNewsFetchTimestamp > NEWS_CACHE_TTL_MS || cachedLiveNewsCatalysts.length === 0) {
    const liveItems = await fetchRealTimeLiveNews();
    if (liveItems && liveItems.length > 0) {
      cachedLiveNewsCatalysts = liveItems;
      lastNewsFetchTimestamp = now;
    }
  }

  // Nothing cached and every source failed: say so instead of returning an empty "success"
  if (cachedLiveNewsCatalysts.length === 0) {
    return res.status(503).json({
      success: false,
      feedStatus: 'UNAVAILABLE',
      error: 'News sources are unreachable right now. Please try again shortly.',
    });
  }

  // Calculate fresh timeAgo for each item relative to current moment
  let catalystsToReturn = cachedLiveNewsCatalysts.map((c) => ({
    ...c,
    timeAgo: calculateRelativeTime(c.timestamp),
  }));

  if (categoryFilter && categoryFilter !== 'all') {
    catalystsToReturn = catalystsToReturn.filter((c) => c.category === categoryFilter);
  }

  res.json({
    success: true,
    // STALE when refreshes have been failing and we are serving an old cache
    feedStatus: now - lastNewsFetchTimestamp > 5 * 60 * 1000 ? 'STALE' : 'LIVE_STREAMING',
    source: 'google-news-rss-live',
    lastUpdated: new Date(lastNewsFetchTimestamp || now).toISOString(),
    pollIntervalMs: 30000,
    count: catalystsToReturn.length,
    catalysts: catalystsToReturn,
  });
});

// Kick off live news warm-up immediately on server start
fetchRealTimeLiveNews()
  .then((items) => {
    if (items && items.length > 0) {
      cachedLiveNewsCatalysts = items;
      lastNewsFetchTimestamp = Date.now();
      console.log(`[NewsWire] Pre-warmed ${items.length} real-time live articles.`);
    }
  })
  .catch((err) => console.warn('[NewsWire] Warmup warning:', err));

// -------------------------------------------------------------
// POST /api/news/analyze - AI Market News & Catalyst Trading Impact Analyzer
// -------------------------------------------------------------
app.post('/api/news/analyze', async (req: Request, res: Response) => {
  const { headline, category, context, userSymbols } = req.body;

  if (!headline || typeof headline !== 'string' || !headline.trim()) {
    return res.status(400).json({ error: 'headline parameter is required.' });
  }

  const trimmedHeadline = headline.trim();

  // If Gemini API Key is configured, run Gemini 3.8 Flash model
  if (process.env.GEMINI_API_KEY && aiClient) {
    try {
      const systemInstruction = `You are the Senior Quantitative Macro Strategist and Futures Execution Lead for TradePulse.
Your job is to rigorously analyze market news headlines, economic data releases, regulatory actions, and Binance futures listings, and determine their precise trading impact.

You must output valid JSON matching this schema:
{
  "sentiment": "BULLISH" | "BEARISH" | "VOLATILE_CHOP" | "NEUTRAL",
  "impactLevel": "HIGH" | "MEDIUM" | "LOW",
  "impactScore": number (1 to 10),
  "affectedAssets": string[] (e.g. ["BTCUSDT.P", "ETHUSDT.P", "SPY", "QQQ", "DXY"]),
  "summary": string (concise 2-sentence institutional summary of the catalyst),
  "marketMechanism": string (how this flows through liquidity, interest rates, funding rates, or order flow),
  "tradingTakeaway": string (one powerful sentence on what this means for day/swing traders),
  "tacticalAdvice": {
    "recommendedAction": string (e.g. "Wait for 15-min opening range retest", "Fade false breakout", "Reduce risk by 50%"),
    "stopLossGuidance": string (clear stop distance and structural invalidation advice),
    "bestSetup": string (e.g. "VWAP pullback long", "Liquidity sweep reversal short"),
    "volatilityWarning": string (spread widening, liquidation cascade, or whipsaw notice)
  },
  "keyRisks": string[]
}`;

      const prompt = `Analyze this trading catalyst:
Headline: "${trimmedHeadline}"
Category: ${category || 'general'}
Additional Context: ${context || 'None'}
Trader Active Watchlist/Positions: ${JSON.stringify(userSymbols || ['BTCUSDT.P', 'ETHUSDT.P', 'SPY'])}

Evaluate the directional bias, volatility surge risk, affected Binance perpetual futures / equity symbols, and provide an actionable execution playbook.`;

      const geminiResponse = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      const responseText = geminiResponse.text;
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          return res.json({
            success: true,
            analysis: {
              ...parsed,
              headline: trimmedHeadline,
              source: 'gemini-3.8-flash',
              analyzedAt: new Date().toISOString(),
            },
          });
        } catch (jsonErr) {
          console.warn('Could not parse Gemini JSON response, falling back to structured engine:', jsonErr);
        }
      }
    } catch (aiErr: any) {
      console.error('Gemini API news analysis error:', aiErr?.message || aiErr);
    }
  }

  // Institutional Quantitative News Engine Fallback
  const lower = trimmedHeadline.toLowerCase();

  let sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE_CHOP' | 'NEUTRAL' = 'NEUTRAL';
  let impactLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let impactScore = 6;
  const affectedAssets: string[] = [];
  let summary = '';
  let marketMechanism = '';
  let tradingTakeaway = '';
  let recommendedAction = '';
  let stopLossGuidance = '';
  let bestSetup = '';
  let volatilityWarning = '';
  const keyRisks: string[] = [];

  // Determine affected assets
  if (lower.includes('binance') || lower.includes('perpetual') || lower.includes('listing') || lower.includes('leverage')) {
    affectedAssets.push('BTCUSDT.P', 'SOLUSDT.P', 'BNBUSDT.P');
  }
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('etf') || lower.includes('crypto')) {
    if (!affectedAssets.includes('BTCUSDT.P')) affectedAssets.push('BTCUSDT.P');
    if (!affectedAssets.includes('ETHUSDT.P')) affectedAssets.push('ETHUSDT.P');
  }
  if (lower.includes('fed') || lower.includes('fomc') || lower.includes('powell') || lower.includes('cpi') || lower.includes('inflation') || lower.includes('rate cut') || lower.includes('rate hike')) {
    affectedAssets.push('SPY', 'QQQ', 'BTCUSDT.P', 'DXY', 'USDJPY');
  }
  if (lower.includes('nvidia') || lower.includes('tech') || lower.includes('ai') || lower.includes('semiconductor') || lower.includes('nasdaq')) {
    affectedAssets.push('QQQ', 'NVDA', 'SPY');
  }
  if (affectedAssets.length === 0) {
    affectedAssets.push('BTCUSDT.P', 'SPY', 'DXY');
  }

  // Determine sentiment & impact
  if (lower.includes('cpi cooler') || lower.includes('rate cut') || lower.includes('etf inflow') || lower.includes('approval') || lower.includes('surge') || lower.includes('record high') || lower.includes('beat') || lower.includes('settlement')) {
    sentiment = 'BULLISH';
    impactLevel = 'HIGH';
    impactScore = 8;
    summary = `The headline signals loosening financial conditions, expanding liquidity, or strong institutional capital allocation into risk assets.`;
    marketMechanism = `Dollar index and bond yield compression stimulate risk appetite, driving spot buying and aggressive perpetual futures bidding.`;
    tradingTakeaway = `Expect momentum continuation to the upside; prioritize long dips into structural support over fading rallies.`;
    recommendedAction = `Look for long entries on pullbacks to the 15-minute VWAP with positive cumulative volume delta.`;
    stopLossGuidance = `Anchor stop loss below the pre-breakout consolidation low; avoid trailing too tightly during initial expansions.`;
    bestSetup = `Opening Range Breakout (ORB) continuation on high relative volume.`;
    volatilityWarning = `Watch out for sudden funding rate spikes on perpetuals (> 0.03%) which can trigger leveraged long flushes.`;
    keyRisks.push('Funding rate overheating', 'Liquidity exhaustion at higher time-frame resistance', 'Profit taking at daily round levels');
  } else if (lower.includes('rate hike') || lower.includes('cpi hotter') || lower.includes('delisting') || lower.includes('ban') || lower.includes('subpoena') || lower.includes('liquidation') || lower.includes('crash') || lower.includes('recession') || lower.includes('hawkish')) {
    sentiment = 'BEARISH';
    impactLevel = 'HIGH';
    impactScore = 9;
    summary = `Macro tightening pressures or adverse regulatory/exchange interventions threaten market liquidity and trigger risk-off derisking.`;
    marketMechanism = `Deleveraging across centralized venues forces margin calls and liquidation cascades down into order book bid clusters.`;
    tradingTakeaway = `Elevated downside momentum; long breakouts are prone to immediate failure. Prioritize short setups or preserve cash.`;
    recommendedAction = `Fade weak bounces into newly formed resistance order blocks or stay on the sidelines until the 4-hour candle closes.`;
    stopLossGuidance = `Place stops above the breakdown swing high; widen stop distances by 1.5x and cut position size to keep dollar risk fixed.`;
    bestSetup = `Liquidity sweep into resistance followed by rapid breakdown (Bearish MSS).`;
    volatilityWarning = `Severe slippage on stop orders during cascade flushes; avoid market selling at the lows.`;
    keyRisks.push('Cascading stop runs', 'Wide exchange bid-ask spreads', 'Sharp dead-cat bounce traps');
  } else if (lower.includes('perpetual') || lower.includes('listing') || lower.includes('leverage') || lower.includes('fomc') || lower.includes('speech') || lower.includes('volatility')) {
    sentiment = 'VOLATILE_CHOP';
    impactLevel = 'HIGH';
    impactScore = 8;
    summary = `High uncertainty event capable of generating rapid two-way market spikes and stop-hunting sweeps before establishing trend direction.`;
    marketMechanism = `Market makers widen spreads and pull limit order liquidity ahead of the event, exaggerating small order flow into wide price swings.`;
    tradingTakeaway = `Wait for the dust to settle. Entering prior to or during the initial 5 minutes carries poor risk-to-reward.`;
    recommendedAction = `Wait 15 to 30 minutes after the release to identify true institutional direction before committing risk.`;
    stopLossGuidance = `Keep stop loss outside daily average true range (ATR) levels or use option hedges rather than tight stop orders.`;
    bestSetup = `Post-whipsaw range reclamation trade once both highs and lows have been swept.`;
    volatilityWarning = `High frequency algorithms actively hunt resting retail liquidity pools on both sides of the book.`;
    keyRisks.push('Double wick stops', 'Order execution latency during peak volatility', 'Exchange connectivity throttle');
  } else {
    sentiment = 'NEUTRAL';
    impactLevel = 'LOW';
    impactScore = 4;
    summary = `Headline is largely priced in or does not substantially alter macro liquidity or institutional positioning.`;
    marketMechanism = `Standard liquidity distribution; algorithmic market makers maintain baseline bid-ask spreads without dislocation.`;
    tradingTakeaway = `Trade standard technical patterns according to your core playbook without requiring headline risk adjustments.`;
    recommendedAction = `Stick to regular strategy rules and standard 1.0% risk sizing.`;
    stopLossGuidance = `Standard structural stop loss placement based on technical chart structure.`;
    bestSetup = `Standard playbook setup (e.g. Trend pullback, VWAP bounce).`;
    volatilityWarning = `Normal market conditions.`;
    keyRisks.push('Overtrading in low-volatility conditions', 'False breakout chops in low-volume periods');
  }

  res.json({
    success: true,
    analysis: {
      headline: trimmedHeadline,
      sentiment,
      impactLevel,
      impactScore,
      affectedAssets,
      summary,
      marketMechanism,
      tradingTakeaway,
      tacticalAdvice: {
        recommendedAction,
        stopLossGuidance,
        bestSetup,
        volatilityWarning,
      },
      keyRisks,
      source: 'tradepulse-catalyst-engine',
      analyzedAt: new Date().toISOString(),
    },
  });
});

// Serve static public folder for manifest and icons
app.use(express.static(path.resolve(__dirname, 'public')));

// -------------------------------------------------------------
// Vite Dev Server Middleware or Production Static Serving
// -------------------------------------------------------------
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`TradePulse Full-Stack Server running on port ${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
});
