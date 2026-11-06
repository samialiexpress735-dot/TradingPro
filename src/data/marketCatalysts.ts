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

export const INITIAL_NEWS_CATALYSTS: NewsCatalyst[] = [
  {
    id: 'news-1',
    headline: 'US Core CPI Inflation Prints Cooler at 2.8% YoY vs 3.0% Consensus; Rate Cut Odds Surge to 82%',
    source: 'Bureau of Labor Statistics / Bloomberg Macro',
    timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    timeAgo: '25m ago',
    category: 'macro',
    impactLevel: 'HIGH',
    sentiment: 'BULLISH',
    affectedSymbols: ['BTCUSDT.P', 'ETHUSDT.P', 'SPY', 'QQQ', 'DXY'],
    summary: 'Core CPI came in lower than Wall Street estimates across both monthly and annualized prints. The US Dollar Index (DXY) slipped 0.6%, triggering an immediate liquidity injection into risk assets and perpetual futures.',
    tradingTakeaway: 'DXY weakness provides a strong tailwind for Bitcoin and tech equities. High probability of continuation above the opening range high.',
    tacticalAdvice: {
      recommendedAction: 'Favor Long trend-following on retests of the 15-minute Opening Range Breakout.',
      stopLossGuidance: 'Place stops below the pre-release consolidation low rather than chasing the initial wick.',
      bestSetup: 'Pullback to 5-min VWAP on BTCUSDT.P with positive delta confirmation.',
      volatilityWarning: 'Spreads widen 2x in the first 3 minutes; avoid market orders during release seconds.',
    },
    keyMetrics: {
      expected: '3.0%',
      previous: '3.1%',
      actual: '2.8%',
    },
  },
  {
    id: 'news-2',
    headline: 'Binance Futures Announces New Perpetual Contract Listings with Up to 50x Leverage & Negative Maker Fees',
    source: 'Binance Exchange Official Announcement',
    timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    timeAgo: '55m ago',
    category: 'crypto',
    impactLevel: 'HIGH',
    sentiment: 'VOLATILE_CHOP',
    affectedSymbols: ['BTCUSDT.P', 'SOLUSDT.P', 'BNBUSDT.P'],
    summary: 'Binance is expanding its perpetual contracts suite with zero maker fees for the first 30 days. Historically, perpetual listings trigger massive speculative open interest followed by severe funding rate skew and liquidation cascades.',
    tradingTakeaway: 'Anticipate extreme intraday volatility and erratic wick rejections on altcoin perpetuals. High chance of false breakouts at initial listing highs.',
    tacticalAdvice: {
      recommendedAction: 'Wait for the first 4-hour cycle before entering swing positions. Monitor funding rate; if > +0.05%, beware of long squeezes.',
      stopLossGuidance: 'Use wider stop losses (minimum 2.5% to 3.5%) or cut position sizing by 50% to prevent sweep liquidations.',
      bestSetup: 'Mean-reversion short from overheated premium, or breakout only after 1-hour volume consolidation.',
      volatilityWarning: 'Perpetual contract funding volatility can cause slippage on stop-market triggers.',
    },
  },
  {
    id: 'news-3',
    headline: 'Federal Reserve FOMC Press Conference: Chair Powell Signals Neutral Rate May Be Higher, Resists Aggressive Easing',
    source: 'Federal Reserve Board / FOMC Transcript',
    timestamp: new Date(Date.now() - 130 * 60 * 1000).toISOString(),
    timeAgo: '2h ago',
    category: 'macro',
    impactLevel: 'HIGH',
    sentiment: 'BEARISH',
    affectedSymbols: ['SPY', 'QQQ', 'BTCUSDT.P', 'USDJPY', 'DXY'],
    summary: 'Fed Chair emphasized that while inflation is moderating, the labor market remains resilient enough that the committee feels no urgency to cut rapidly. Treasury yields rebounded 7 bps across the 10-year curve.',
    tradingTakeaway: 'Bond yields firming puts downward pressure on growth valuations and high-multiple assets. Risk-on momentum faces immediate overhead resistance.',
    tacticalAdvice: {
      recommendedAction: 'Exercise caution on long breakout trades near multi-week highs. Look for failed breakout traps.',
      stopLossGuidance: 'Tighten trailing stops on existing profit-taking runners. Do not hold unprotected naked futures.',
      bestSetup: 'Liquidity sweep reversal short when price tests major liquidity pool and creates a bearish market structure shift (MSS).',
      volatilityWarning: 'Two-way whipsaw risk remains elevated for 90 minutes following Fed speeches.',
    },
  },
  {
    id: 'news-4',
    headline: 'Institutional Spot Bitcoin ETFs Register Record $840M Net Inflows in Single Session led by BlackRock & Fidelity',
    source: 'Farside Investors / SEC ETF Flow Data',
    timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    timeAgo: '4h ago',
    category: 'crypto',
    impactLevel: 'HIGH',
    sentiment: 'BULLISH',
    affectedSymbols: ['BTCUSDT.P', 'ETHUSDT.P', 'IBIT'],
    summary: 'Net institutional demand absorbed more than 12x the daily newly minted Bitcoin supply. OTC desk inventories are depleting rapidly, transferring spot dominance back into regulated custody channels.',
    tradingTakeaway: 'Dips into structural support are consistently being bought aggressively by institutional TWAP algorithms during US market hours.',
    tacticalAdvice: {
      recommendedAction: 'Buy dips into key 1-hour / 4-hour order blocks during New York cash session opens (09:30 - 11:30 EST).',
      stopLossGuidance: 'Place stops below the prior daily swing low; high institutional backing minimizes sustained structural breakdowns.',
      bestSetup: 'VWAP anchor bounce from previous day New York close.',
      volatilityWarning: 'Weekend liquidity gap risk: futures basis premium might compress on Sundays.',
    },
  },
  {
    id: 'news-5',
    headline: 'Nvidia Unveils Next-Gen AI Silicon Architecture with 3x Inference Efficiency; Datacenter Orders Booked through Q4',
    source: 'Semiconductor Industry Daily / Reuters',
    timestamp: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    timeAgo: '6h ago',
    category: 'equities',
    impactLevel: 'MEDIUM',
    sentiment: 'BULLISH',
    affectedSymbols: ['NVDA', 'QQQ', 'AMD', 'MSFT'],
    summary: 'Surpassing supplier estimates, major cloud hyperscalers committed capital expenditure increases for AI hardware pipelines. Semiconductor supply chain equities rallied across Asian and European sessions.',
    tradingTakeaway: 'Tech sector beta remains exceptionally strong. Pullbacks in semiconductor leaders are prime trend-continuation candidates.',
    tacticalAdvice: {
      recommendedAction: 'Focus on relative strength leaders. When QQQ pulls back, identify semiconductor tickers that hold intraday VWAP.',
      stopLossGuidance: 'Anchor risk to 1.5R with stop loss under the 30-minute consolidation shelf.',
      bestSetup: 'Break of pre-market high with high relative volume (RVOL > 2.0).',
      volatilityWarning: 'Option gamma pinning near round strike prices ($130, $140) may cause afternoon consolidation.',
    },
  },
  {
    id: 'news-6',
    headline: 'Crude Oil Surges 4.2% on Red Sea Shipping Disruption; Inflation Expectations Tick Higher',
    source: 'Energy Information Administration / Platts',
    timestamp: new Date(Date.now() - 480 * 60 * 1000).toISOString(),
    timeAgo: '8h ago',
    category: 'macro',
    impactLevel: 'MEDIUM',
    sentiment: 'BEARISH',
    affectedSymbols: ['XOM', 'USO', 'SPY', 'DXY'],
    summary: 'Rerouted tanker fleets and higher maritime insurance premiums sparked an immediate supply premium spike in Brent and WTI crude contracts. Inflation breakevens widened by 9 basis points.',
    tradingTakeaway: 'Rising energy costs threaten consumer discretionary spending and compress profit margins across transport and retail sectors.',
    tacticalAdvice: {
      recommendedAction: 'Rotate risk exposure away from retail/consumer staples into energy and cash reserves.',
      stopLossGuidance: 'Strict 1% portfolio risk rule; energy spikes historically increase intraday correlation across unrelated equities.',
      bestSetup: 'Breakout pullback on energy ETF or commodity futures long.',
      volatilityWarning: 'Sudden diplomatic headlines can trigger sharp 3% reversals in oil futures.',
    },
  },
  {
    id: 'news-7',
    headline: 'European Central Bank (ECB) Holds Benchmark Interest Rate Steady at 3.25%, Hints at Flexible Timing for Next Step',
    source: 'European Central Bank Press Release',
    timestamp: new Date(Date.now() - 720 * 60 * 1000).toISOString(),
    timeAgo: '12h ago',
    category: 'forex',
    impactLevel: 'LOW',
    sentiment: 'NEUTRAL',
    affectedSymbols: ['EURUSD', 'DXY', 'DAX'],
    summary: 'As widely anticipated, Christine Lagarde reaffirmed that policy decisions remain strictly meeting-by-meeting and data-dependent. Euro traded in a tight 20-pip range.',
    tradingTakeaway: 'Non-event for global equities and crypto. Standard range-bound liquidity behavior without trend expansion.',
    tacticalAdvice: {
      recommendedAction: 'Stick to range-bound scalping between session high and session low.',
      stopLossGuidance: 'Standard tight stops outside previous 4-hour highs/lows.',
      bestSetup: 'Failed auction fade back toward the 1.0850 median point of control (POC).',
      volatilityWarning: 'Low volatility environment — beware of sudden thin liquidity slippage outside London hours.',
    },
  },
];

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
