export type AssetClass = 'stocks' | 'crypto' | 'forex' | 'futures' | 'options';
export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'closed' | 'open';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open';

export type EmotionalState =
  | 'Disciplined'
  | 'Patient'
  | 'FOMO'
  | 'Revenge'
  | 'Hesitant'
  | 'Greedy'
  | 'Fearful'
  | 'Euphoric';

export type TradeMistake =
  | 'Followed Plan'
  | 'Moved Stop Loss'
  | 'Exited Too Early'
  | 'Held Loser Too Long'
  | 'Overleveraged'
  | 'Chased Entry'
  | 'Ignored HTF Trend'
  | 'News Gamble'
  | 'No Stop Loss'
  | 'Revenge Trade'
  | 'Flipped Bias';

export type MarketSession =
  | 'Pre-Market'
  | 'Market Open (NY)'
  | 'Mid-Day'
  | 'Power Hour'
  | 'After-Hours'
  | 'Asian Session'
  | 'London Session'
  | '24/7 Crypto';

export interface Trade {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  exitDate?: string;
  exitTime?: string;
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  status: TradeStatus;
  outcome: TradeOutcome;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  fees: number;
  grossPnl: number;
  netPnl: number;
  roi: number; // percentage
  plannedRR: number;
  realizedRR: number;
  strategy: string;
  rating: number; // 1 to 5
  emotion: EmotionalState;
  mistake?: TradeMistake;
  notes: string;
  chartUrl?: string;
  marketSession?: MarketSession;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  color: string;
  rules: string[];
}

export interface PerformanceStats {
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakEvenTrades: number;
  winRate: number; // %
  grossProfit: number;
  grossLoss: number;
  netProfit: number;
  totalFees: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  winLossRatio: number;
  expectancy: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  bestTrade: number;
  worstTrade: number;
  largestWinStreak: number;
  largestLossStreak: number;
}

export interface DailyPnL {
  date: string;
  pnl: number;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  trades: Trade[];
}

export interface EquityPoint {
  index: number;
  date: string;
  tradeId?: string;
  symbol?: string;
  pnl: number;
  equity: number;
  drawdown: number;
  disciplinedEquity: number;
  disciplineDelta: number;
}

export interface MistakeAnalysis {
  mistake: TradeMistake;
  count: number;
  winRate: number;
  totalLost: number;
  netPnl: number;
  avgPnl: number;
}

export interface DisciplineMetrics {
  totalMistakeCost: number; // money lost directly on non-followed-plan trades
  followedPlanWinRate: number;
  deviatedWinRate: number;
  followedPlanAvgWin: number;
  followedPlanNetPnl: number;
  deviatedNetPnl: number;
  topLeaks: MistakeAnalysis[];
  potentialDisciplinedGain: number; // how much better the portfolio would be
}

export interface DailyReview {
  id: string;
  date: string; // YYYY-MM-DD
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  marketConditions:
    | 'Trending Bullish'
    | 'Trending Bearish'
    | 'Choppy / Range-Bound'
    | 'High Volatility / News'
    | 'Low Volume / Quiet';
  sleepQuality: number; // 1-10
  focusLevel: number; // 1-10
  rulesFollowedPct: number; // 0-100
  checklistCompleted: boolean;
  morningNotes: string;
  eveningNotes: string;
  keyTakeaway: string;
  chartUrl?: string;
  updatedAt: string;
}

export interface RiskCalcInput {
  accountBalance: number;
  riskPercentage: number;
  fixedRiskAmount?: number;
  riskMode?: 'percent' | 'dollar';
  entryPrice: number;
  stopLossPrice: number;
  targetPrice?: number;
  assetClass: AssetClass;
  leverage?: number;
  pointMultiplier?: number; // e.g. 100 for options, 1 for Binance crypto futures
}

export interface RiskCalcResult {
  riskAmount: number; // Planned dollar risk
  priceRiskPerUnit: number;
  priceRiskPercent: number;
  positionSize: number; // Exact calculated quantity / size
  quantity: number; // Alias for positionSize
  unitLabel: string; // 'Shares', 'Contracts', 'Coins', 'Lots', 'Units'
  positionValue: number; // Total dollar value of the position
  actualRisk: number; // Actual dollar loss if stopped out with rounded quantity
  actualRiskPercent: number;
  rewardPerUnit?: number;
  targetProfit?: number;
  rewardToRisk?: number;
  marginRequired: number;
  isOverLeveraged: boolean;
  stepFormula?: {
    step1Risk: string;
    step2Distance: string;
    step3Quantity: string;
    step4LossAtStop: string;
    step5GainAtTarget: string;
  };
}

export interface CapitalTransaction {
  id: string;
  date: string; // ISO string
  type: 'deposit' | 'withdrawal';
  amount: number;
  note?: string;
  balanceBefore: number;
  balanceAfter: number;
}

