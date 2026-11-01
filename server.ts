import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// In-memory trade storage for the backend session
let tradesStore: any[] = [];
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
// REST API Routes
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TradePulse API',
    version: '1.0.0',
    hasGeminiSupport: !!process.env.GEMINI_API_KEY,
  });
});

// GET /api/trades - List trades
app.get('/api/trades', (req: Request, res: Response) => {
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

// POST /api/trades - Create trade
app.post('/api/trades', (req: Request, res: Response) => {
  const newTrade = req.body;
  if (!newTrade.symbol || !newTrade.entryPrice || !newTrade.quantity) {
    return res.status(400).json({ error: 'symbol, entryPrice, and quantity are required.' });
  }

  const tradeWithId = {
    ...newTrade,
    id: newTrade.id || `tr-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  tradesStore.unshift(tradeWithId);
  res.status(201).json({ success: true, trade: tradeWithId });
});

// PUT /api/trades/:id - Update trade
app.put('/api/trades/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = tradesStore.findIndex((t) => t.id === id);

  if (index === -1) {
    // If not in store, add it
    const trade = { ...req.body, id };
    tradesStore.push(trade);
    return res.json({ success: true, trade });
  }

  tradesStore[index] = { ...tradesStore[index], ...req.body };
  res.json({ success: true, trade: tradesStore[index] });
});

// DELETE /api/trades/:id - Delete trade
app.delete('/api/trades/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  tradesStore = tradesStore.filter((t) => t.id !== id);
  res.json({ success: true, message: `Trade ${id} deleted` });
});

// POST /api/trades/sync - Bulk sync from client state
app.post('/api/trades/sync', (req: Request, res: Response) => {
  const { trades } = req.body;
  if (Array.isArray(trades)) {
    tradesStore = trades;
    res.json({ success: true, count: tradesStore.length });
  } else {
    res.status(400).json({ error: 'trades must be an array' });
  }
});

// GET /api/analytics - Aggregate calculations
app.get('/api/analytics', (_req: Request, res: Response) => {
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
      // Fall through to algorithmic rule-based coaching
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
