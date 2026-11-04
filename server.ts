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

interface PersistentDB {
  users: UserRecord[];
  userTrades: Record<string, any[]>;
  userStrategies: Record<string, any[]>;
  userReviews: Record<string, any[]>;
  userSettings: Record<string, { startingBalance: number; currency: string; riskPct: number }>;
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

  const settings = db.userSettings[userId] || { startingBalance: 25000, currency: 'USD', riskPct: 1.0 };
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
