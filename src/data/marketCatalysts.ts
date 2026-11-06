export interface NewsCatalyst {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  timeAgo: string;
  category: 'crypto' | 'macro' | 'equities' | 'forex';
  impactLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  sentiment: 'BULLISH' | 'BEARISH' | 'VOLATILE_CHOP' | 'NEUTRAL';
  affectedSymbols: string[];
  summary: string;
  tradingTakeaway: string;
  tacticalAdvice: {
    recommendedAction: string;
    stopLossGuidance: string;
    bestSetup: string;
    volatilityWarning: string;
  };
  keyMetrics?: {
    expected?: string;
    previous?: string;
    actual?: string;
  };
  link?: string;
}

export const INITIAL_NEWS_CATALYSTS: NewsCatalyst[] = [];

export const PRESET_ANALYSIS_PROMPTS = [
  {
    label: 'Binance Futures Delisting Alert',
    text: 'Binance Futures announced it will delist multiple low-liquidity perpetual contracts with 5x leverage cap reduction and automatic settlement in 48 hours.',
  },
  {
    label: 'US Non-Farm Payrolls (NFP) Shock',
    text: 'US Non-Farm Payrolls printed 275k vs 160k expected, with average hourly earnings surging 0.5% MoM, spiking bond yields.',
  },
  {
    label: 'SEC Regulatory Settlement',
    text: 'SEC reaches multi-billion comprehensive regulatory settlement with top cryptocurrency platform, removing major existential overhang for spot & perpetual trading.',
  },
  {
    label: 'Federal Reserve Emergency Statement',
    text: 'Federal Reserve announces unexpected liquidity facility expansion for regional banking reserves, weakening the US Dollar Index DXY.',
  },
];
