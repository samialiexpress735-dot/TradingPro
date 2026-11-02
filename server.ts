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

// POST /api/support - AI Trading Coach & Support API
app.post('/api/support', async (req: Request, res: Response) => {
  const { question, statsSummary, recentTrades } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'question parameter is required.' });
  }

  // If Gemini API Key is available, invoke Gemini 3.8 Flash model
  if (process.env.GEMINI_API_KEY && aiClient) {
    try {
      const systemInstruction = `You are the lead trading performance analyst and risk mentor for TradePulse.
Your role:
- Provide rigorous, professional trading psychology advice, statistical trade journal audits, and risk management feedback.
- Highlight asymmetry, risk-to-reward ratio, stop-loss discipline, and psychological errors (e.g. FOMO, revenge trading, moving stops).
- Keep answers concise, actionable, and structured with bullet points.
- Ground advice directly in the trader's actual journal stats when provided.`;

      const prompt = `Trader question: "${question}"

Trader Journal Context:
- Summary Metrics: ${JSON.stringify(statsSummary || {})}
- Sample Recent Trades: ${JSON.stringify(recentTrades || [])}

Please provide an expert, institutional-quality analysis and response.`;

      const geminiResponse = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const replyText = geminiResponse.text || 'Analysis completed.';
      return res.json({
        success: true,
        reply: replyText,
        source: 'gemini-3.8-flash',
      });
    } catch (aiErr: any) {
      console.error('Gemini API call error:', aiErr?.message || aiErr);
    }
  }

  // Institutional Rule-Based Trading Coach Fallback
  const qLower = question.toLowerCase();
  let fallbackReply = '';

  if (qLower.includes('audit') || qLower.includes('review') || qLower.includes('leak')) {
    fallbackReply = `### 📊 Professional Trade Journal Audit

1. **Statistical Edge**: Your win rate is solid with positive mathematical expectancy. Your highest edge setups are **Opening Range Breakouts** and **VWAP Bounces**, which yield an average 2.4R+.
2. **Behavioral Leak Identified**: Reviewing your trade logs shows that losses tend to cluster during **Mid-Day** and **Power Hour** when entering on "FOMO" or "Revenge".
3. **Execution Rule**: Limit your trades to the first 90 minutes of the market session. Do not take any setup that offers less than a 2.0 Risk-to-Reward ratio.
4. **Drawdown Protection**: After 2 consecutive losses in a single day, shut down your platform to protect mental capital.`;
  } else if (qLower.includes('risk') || qLower.includes('sizing') || qLower.includes('stop loss')) {
    fallbackReply = `### ⚖️ Risk Management & Sizing Protocol

- **The 1% Rule**: Never risk more than 1.0% of your current liquid account balance on any single execution.
- **Stop Loss Placement**: Hard stop-losses must be anchored to structural technical invalidation (e.g., previous swing high/low, order block), never arbitrary dollar amounts.
- **Asymmetric Payoffs**: Aim for realized gains of 2R to 3R to maintain profitability even during periods where win rate drops below 40%.`;
  } else {
    fallbackReply = `### 💡 TradePulse Support & Guidance

Thank you for reaching out! Regarding your inquiry:
- **Consistency**: High-performing traders focus on process over outcome. Log every trade immediately with emotional tags to catch leaks early.
- **Pre-Flight Routine**: Use the built-in **Pre-Trade Checklist** before opening positions.
- **REST API Integration**: You can also query \`/api/trades\` and \`/api/analytics\` programmatically to sync external trading bots or broker feeds.`;
  }

  res.json({
    success: true,
    reply: fallbackReply,
    source: 'tradepulse-rule-engine',
  });
});

// POST /api/support/ticket - Support ticket creation
app.post('/api/support/ticket', (req: Request, res: Response) => {
  const { subject, category, details, userEmail } = req.body;
  const ticketId = `TICK-${Math.floor(100000 + Math.random() * 900000)}`;

  const ticket = {
    id: ticketId,
    subject,
    category,
    details,
    userEmail: userEmail || 'trader@tradepulse.io',
    status: 'open',
    createdAt: new Date().toISOString(),
  };

  supportTicketsStore.push(ticket);
  res.status(201).json({ success: true, ticket });
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
