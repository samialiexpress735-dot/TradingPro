import {
  Trade,
  PerformanceStats,
  DailyPnL,
  EquityPoint,
  RiskCalcInput,
  RiskCalcResult,
} from '../types/trade';

export function calculateTradeMetrics(params: {
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  fees: number;
}) {
  const { direction, entryPrice, exitPrice, quantity, stopLoss, takeProfit, fees } = params;

  if (entryPrice <= 0 || quantity <= 0) {
    return { grossPnl: 0, netPnl: 0, roi: 0, plannedRR: 0, realizedRR: 0, outcome: 'breakeven' as const };
  }

  const multiplier = direction === 'long' ? 1 : -1;
  const priceDiff = (exitPrice - entryPrice) * multiplier;
  const grossPnl = Number((priceDiff * quantity).toFixed(2));
  const netPnl = Number((grossPnl - (fees || 0)).toFixed(2));

  const investedCapital = entryPrice * quantity;
  const roi = investedCapital > 0 ? Number(((netPnl / investedCapital) * 100).toFixed(2)) : 0;

  // Planned Risk / Reward
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const plannedRewardPerUnit = Math.abs(takeProfit - entryPrice);
  const plannedRR = riskPerUnit > 0 ? Number((plannedRewardPerUnit / riskPerUnit).toFixed(2)) : 0;

  // Realized Risk / Reward (R-multiple)
  const realizedRR = riskPerUnit > 0 ? Number((priceDiff / riskPerUnit).toFixed(2)) : 0;

  let outcome: 'win' | 'loss' | 'breakeven' = 'breakeven';
  if (netPnl > 0.001) {
    outcome = 'win';
  } else if (netPnl < -0.001) {
    outcome = 'loss';
  }

  return {
    grossPnl,
    netPnl,
    roi,
    plannedRR,
    realizedRR,
    outcome,
  };
}

export function calculateStats(trades: Trade[]): PerformanceStats {
  const closed = trades.filter((t) => t.status === 'closed');
  const openTrades = trades.filter((t) => t.status === 'open').length;

  if (closed.length === 0) {
    return {
      totalTrades: trades.length,
      closedTrades: 0,
      openTrades,
      winningTrades: 0,
      losingTrades: 0,
      breakEvenTrades: 0,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netProfit: 0,
      totalFees: 0,
      profitFactor: 0,
      averageWin: 0,
      averageLoss: 0,
      winLossRatio: 0,
      expectancy: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentStreak: { type: 'none', count: 0 },
      bestTrade: 0,
      worstTrade: 0,
      largestWinStreak: 0,
      largestLossStreak: 0,
    };
  }

  let grossProfit = 0;
  let grossLoss = 0;
  let totalFees = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let breakEvenTrades = 0;
  let bestTrade = -Infinity;
  let worstTrade = Infinity;

  // Sort chronologically for streak and drawdown calculations
  const sorted = [...closed].sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return timeA - timeB;
  });

  let currentStreakCount = 0;
  let currentStreakType: 'win' | 'loss' | 'none' = 'none';
  let maxWinStreak = 0;
  let maxLossStreak = 0;

  sorted.forEach((trade) => {
    const pnl = trade.netPnl;
    totalFees += trade.fees || 0;

    if (pnl > bestTrade) bestTrade = pnl;
    if (pnl < worstTrade) worstTrade = pnl;

    if (trade.outcome === 'win') {
      winningTrades++;
      grossProfit += pnl;

      if (currentStreakType === 'win') {
        currentStreakCount++;
      } else {
        currentStreakType = 'win';
        currentStreakCount = 1;
      }
      if (currentStreakCount > maxWinStreak) maxWinStreak = currentStreakCount;
    } else if (trade.outcome === 'loss') {
      losingTrades++;
      grossLoss += Math.abs(pnl);

      if (currentStreakType === 'loss') {
        currentStreakCount++;
      } else {
        currentStreakType = 'loss';
        currentStreakCount = 1;
      }
      if (currentStreakCount > maxLossStreak) maxLossStreak = currentStreakCount;
    } else {
      breakEvenTrades++;
      currentStreakType = 'none';
      currentStreakCount = 0;
    }
  });

  const netProfit = Number((grossProfit - grossLoss).toFixed(2));
  const winRate = closed.length > 0 ? Number(((winningTrades / closed.length) * 100).toFixed(1)) : 0;
  const profitFactor =
    grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? 99.9 : 0;
  const averageWin = winningTrades > 0 ? Number((grossProfit / winningTrades).toFixed(2)) : 0;
  const averageLoss = losingTrades > 0 ? Number((grossLoss / losingTrades).toFixed(2)) : 0;
  const winLossRatio = averageLoss > 0 ? Number((averageWin / averageLoss).toFixed(2)) : averageWin > 0 ? 10 : 0;

  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const winProb = winningTrades / closed.length;
  const lossProb = losingTrades / closed.length;
  const expectancy = Number((winProb * averageWin - lossProb * averageLoss).toFixed(2));

  // Max Drawdown calculation
  let peak = 0;
  let runningEquity = 0;
  let maxDrawdown = 0;
  let maxDrawdownPct = 0;

  sorted.forEach((trade) => {
    runningEquity += trade.netPnl;
    if (runningEquity > peak) {
      peak = runningEquity;
    }
    const currentDrawdown = peak - runningEquity;
    if (currentDrawdown > maxDrawdown) {
      maxDrawdown = currentDrawdown;
      const base = peak > 1000 ? peak : 10000; // sensible scale if peak is small
      maxDrawdownPct = Number(((maxDrawdown / base) * 100).toFixed(1));
    }
  });

  return {
    totalTrades: trades.length,
    closedTrades: closed.length,
    openTrades,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate,
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    netProfit,
    totalFees: Number(totalFees.toFixed(2)),
    profitFactor,
    averageWin,
    averageLoss,
    winLossRatio,
    expectancy,
    maxDrawdown: Number(maxDrawdown.toFixed(2)),
    maxDrawdownPct,
    currentStreak: { type: currentStreakType, count: currentStreakCount },
    bestTrade: bestTrade === -Infinity ? 0 : Number(bestTrade.toFixed(2)),
    worstTrade: worstTrade === Infinity ? 0 : Number(worstTrade.toFixed(2)),
    largestWinStreak: maxWinStreak,
    largestLossStreak: maxLossStreak,
  };
}

export function generateEquityCurve(trades: Trade[], startingBalance: number = 25000): EquityPoint[] {
  const closed = trades.filter((t) => t.status === 'closed');
  const sorted = [...closed].sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
    const timeB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
    return timeA - timeB;
  });

  const points: EquityPoint[] = [
    {
      index: 0,
      date: sorted.length > 0 ? sorted[0].date : new Date().toISOString().split('T')[0],
      pnl: 0,
      equity: startingBalance,
      drawdown: 0,
      disciplinedEquity: startingBalance,
      disciplineDelta: 0,
    },
  ];

  let currentEquity = startingBalance;
  let currentDisciplinedEquity = startingBalance;
  let peak = startingBalance;

  sorted.forEach((t, i) => {
    currentEquity += t.netPnl;
    if (currentEquity > peak) {
      peak = currentEquity;
    }
    const drawdown = peak - currentEquity;

    // Disciplined scenario: eliminate losses stemming from rule violations
    const isMistakeLoss = t.mistake && t.mistake !== 'Followed Plan' && t.netPnl < 0;
    const disciplinedTradePnl = isMistakeLoss ? 0 : t.netPnl;
    currentDisciplinedEquity += disciplinedTradePnl;

    const delta = currentDisciplinedEquity - currentEquity;

    points.push({
      index: i + 1,
      date: t.exitDate || t.date,
      tradeId: t.id,
      symbol: t.symbol,
      pnl: t.netPnl,
      equity: Number(currentEquity.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
      disciplinedEquity: Number(currentDisciplinedEquity.toFixed(2)),
      disciplineDelta: Number(delta.toFixed(2)),
    });
  });

  return points;
}

export function calculateDisciplineMetrics(trades: Trade[]): import('../types/trade').DisciplineMetrics {
  const closed = trades.filter((t) => t.status === 'closed');
  if (closed.length === 0) {
    return {
      totalMistakeCost: 0,
      followedPlanWinRate: 0,
      deviatedWinRate: 0,
      followedPlanAvgWin: 0,
      followedPlanNetPnl: 0,
      deviatedNetPnl: 0,
      topLeaks: [],
      potentialDisciplinedGain: 0,
    };
  }

  const followedPlanTrades = closed.filter((t) => !t.mistake || t.mistake === 'Followed Plan');
  const mistakeTrades = closed.filter((t) => t.mistake && t.mistake !== 'Followed Plan');

  const totalMistakeCost = mistakeTrades
    .filter((t) => t.netPnl < 0)
    .reduce((sum, t) => sum + Math.abs(t.netPnl), 0);

  const followedWins = followedPlanTrades.filter((t) => t.outcome === 'win');
  const followedPlanWinRate = followedPlanTrades.length > 0 
    ? Number(((followedWins.length / followedPlanTrades.length) * 100).toFixed(1)) 
    : 0;

  const deviatedWins = mistakeTrades.filter((t) => t.outcome === 'win');
  const deviatedWinRate = mistakeTrades.length > 0 
    ? Number(((deviatedWins.length / mistakeTrades.length) * 100).toFixed(1)) 
    : 0;

  const followedPlanNetPnl = Number(followedPlanTrades.reduce((acc, t) => acc + t.netPnl, 0).toFixed(2));
  const deviatedNetPnl = Number(mistakeTrades.reduce((acc, t) => acc + t.netPnl, 0).toFixed(2));
  const followedPlanAvgWin = followedWins.length > 0
    ? Number((followedWins.reduce((acc, t) => acc + t.netPnl, 0) / followedWins.length).toFixed(2))
    : 0;

  const map = new Map<string, { count: number; wins: number; totalLost: number; netPnl: number }>();
  mistakeTrades.forEach((t) => {
    const key = t.mistake!;
    const curr = map.get(key) || { count: 0, wins: 0, totalLost: 0, netPnl: 0 };
    curr.count++;
    if (t.outcome === 'win') curr.wins++;
    if (t.netPnl < 0) curr.totalLost += Math.abs(t.netPnl);
    curr.netPnl += t.netPnl;
    map.set(key, curr);
  });

  const topLeaks: import('../types/trade').MistakeAnalysis[] = Array.from(map.entries())
    .map(([mistake, data]) => ({
      mistake: mistake as import('../types/trade').TradeMistake,
      count: data.count,
      winRate: Number(((data.wins / data.count) * 100).toFixed(1)),
      totalLost: Number(data.totalLost.toFixed(2)),
      netPnl: Number(data.netPnl.toFixed(2)),
      avgPnl: Number((data.netPnl / data.count).toFixed(2)),
    }))
    .sort((a, b) => b.totalLost - a.totalLost);

  return {
    totalMistakeCost: Number(totalMistakeCost.toFixed(2)),
    followedPlanWinRate,
    deviatedWinRate,
    followedPlanAvgWin,
    followedPlanNetPnl,
    deviatedNetPnl,
    topLeaks,
    potentialDisciplinedGain: Number(totalMistakeCost.toFixed(2)),
  };
}

export function groupTradesByDate(trades: Trade[]): Map<string, DailyPnL> {
  const map = new Map<string, DailyPnL>();

  trades.forEach((trade) => {
    const dateKey = trade.exitDate || trade.date;
    const existing = map.get(dateKey) || {
      date: dateKey,
      pnl: 0,
      tradeCount: 0,
      winCount: 0,
      lossCount: 0,
      trades: [],
    };

    existing.pnl += trade.netPnl;
    existing.tradeCount++;
    if (trade.outcome === 'win') existing.winCount++;
    if (trade.outcome === 'loss') existing.lossCount++;
    existing.trades.push(trade);

    map.set(dateKey, existing);
  });

  // round pnls
  map.forEach((item) => {
    item.pnl = Number(item.pnl.toFixed(2));
  });

  return map;
}

export function calculatePositionSize(input: RiskCalcInput): RiskCalcResult {
  const {
    accountBalance,
    riskPercentage,
    fixedRiskAmount,
    riskMode = 'percent',
    entryPrice,
    stopLossPrice,
    targetPrice,
    assetClass,
    leverage = 1,
    pointMultiplier,
  } = input;

  // Determine target dollar risk based on mode
  const riskAmount = riskMode === 'dollar' && fixedRiskAmount !== undefined && fixedRiskAmount > 0
    ? Number(fixedRiskAmount.toFixed(2))
    : Number(((accountBalance * (riskPercentage / 100))).toFixed(2));

  const priceRiskPerUnit = Math.abs(entryPrice - stopLossPrice);
  const priceRiskPercent = entryPrice > 0 ? Number(((priceRiskPerUnit / entryPrice) * 100).toFixed(2)) : 0;

  // Determine unit label
  const unitLabel =
    assetClass === 'stocks'
      ? 'Shares'
      : assetClass === 'futures'
      ? 'Contracts'
      : assetClass === 'options'
      ? 'Contracts'
      : assetClass === 'crypto'
      ? 'Coins'
      : 'Units';

  // Determine point/contract multiplier (Binance USDT-M Futures is 1:1 coin-based)
  const effectiveMultiplier =
    assetClass === 'futures'
      ? 1
      : pointMultiplier && pointMultiplier > 0
      ? pointMultiplier
      : assetClass === 'options'
      ? 100
      : 1;

  if (priceRiskPerUnit <= 0 || entryPrice <= 0 || riskAmount <= 0) {
    return {
      riskAmount,
      priceRiskPerUnit: 0,
      priceRiskPercent: 0,
      positionSize: 0,
      quantity: 0,
      unitLabel,
      positionValue: 0,
      actualRisk: 0,
      actualRiskPercent: 0,
      marginRequired: 0,
      isOverLeveraged: false,
      stepFormula: {
        step1Risk: `Target Risk: $${riskAmount.toFixed(2)}`,
        step2Distance: `Stop Distance: $0.00 (Entry = Stop)`,
        step3Quantity: `Quantity: 0 ${unitLabel}`,
        step4LossAtStop: `Loss at Stop: $0.00`,
        step5GainAtTarget: `Gain at Target: $0.00`,
      },
    };
  }

  // Exact share/unit sizing based on dollar risk:
  // Risk Per Unit = |Entry - Stop| * Multiplier
  const unitLoss = priceRiskPerUnit * effectiveMultiplier;
  const rawSize = riskAmount / unitLoss;

  // Floor or round appropriately depending on asset class
  let positionSize: number;
  if (assetClass === 'crypto' || assetClass === 'futures') {
    // Binance crypto spot & USDT-M futures support up to 8 decimal places (Satoshi level: 0.00000001 BTC)
    positionSize = Number(rawSize.toFixed(8));
  } else if (assetClass === 'forex') {
    // Forex supports micro-lots (0.01 lots) or fractional units
    positionSize = Number(rawSize.toFixed(2));
  } else {
    // Stocks, Options trade in whole integer shares or contracts
    positionSize = Math.floor(rawSize);
  }

  const actualRisk = Number((positionSize * unitLoss).toFixed(2));
  const actualRiskPercent = accountBalance > 0 ? Number(((actualRisk / accountBalance) * 100).toFixed(2)) : 0;
  const positionValue = Number((positionSize * entryPrice * effectiveMultiplier).toFixed(2));
  const effectiveLeverage = leverage > 0 ? leverage : 1;
  const marginRequired = Number((positionValue / effectiveLeverage).toFixed(2));
  const isOverLeveraged = marginRequired > accountBalance;

  let targetProfit: number | undefined;
  let rewardToRisk: number | undefined;
  let rewardPerUnit: number | undefined;

  if (targetPrice && targetPrice > 0) {
    rewardPerUnit = Math.abs(targetPrice - entryPrice);
    targetProfit = Number((rewardPerUnit * effectiveMultiplier * positionSize).toFixed(2));
    rewardToRisk = priceRiskPerUnit > 0 ? Number((rewardPerUnit / priceRiskPerUnit).toFixed(2)) : 0;
  }

  const formattedQtyStr = (assetClass === 'crypto' || assetClass === 'futures')
    ? positionSize.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 8 })
    : positionSize.toLocaleString('en-US');

  // Step-by-step mathematical explanation for the user
  const stepFormula = {
    step1Risk: `Target Risk: $${riskAmount.toFixed(2)} ${
      riskMode === 'percent' ? `(${riskPercentage}% of $${accountBalance.toLocaleString()})` : `(Fixed Dollar Limit)`
    }`,
    step2Distance: `Stop-Loss Distance: $${priceRiskPerUnit.toFixed(priceRiskPerUnit < 0.01 ? 6 : 2)} per unit ${
      effectiveMultiplier > 1 ? `× ${effectiveMultiplier} multiplier = $${unitLoss.toFixed(2)} per contract` : ''
    }`,
    step3Quantity: `Calculated Quantity: $${riskAmount.toFixed(2)} ÷ $${unitLoss.toFixed(unitLoss < 0.01 ? 6 : 2)} = ${formattedQtyStr} ${unitLabel}`,
    step4LossAtStop: `Actual Loss if Stopped Out: ${formattedQtyStr} ${unitLabel} × $${unitLoss.toFixed(unitLoss < 0.01 ? 6 : 2)} = -$${actualRisk.toFixed(2)} (${actualRiskPercent}% equity)`,
    step5GainAtTarget: targetPrice && targetPrice > 0
      ? `Estimated Gain if Target Hit: ${formattedQtyStr} ${unitLabel} × $${((rewardPerUnit || 0) * effectiveMultiplier).toFixed(2)} = +$${(targetProfit || 0).toFixed(2)} (${rewardToRisk} R:R)`
      : 'Set a Target Price to project profit and R:R ratio',
  };

  return {
    riskAmount,
    priceRiskPerUnit: Number(priceRiskPerUnit.toFixed(4)),
    priceRiskPercent,
    positionSize,
    quantity: positionSize,
    unitLabel,
    positionValue,
    actualRisk,
    actualRiskPercent,
    rewardPerUnit,
    targetProfit,
    rewardToRisk,
    marginRequired,
    isOverLeveraged,
    stepFormula,
  };
}

export function calculateRiskOfRuin(winRatePct: number, rewardRiskRatio: number, riskPerTradePct: number) {
  // Simplified Perry Kaufman / Ralph Vince risk of ruin approximation
  const p = winRatePct / 100;
  const q = 1 - p;
  const b = rewardRiskRatio;

  if (p <= 0 || b <= 0) return 100;
  const edge = p * b - q;
  if (edge <= 0) return 99.9; // Negative expectancy means certainty of ruin over infinite horizon

  // Probability of 20% drawdown with current risk%
  const riskUnits = 20 / riskPerTradePct;
  const z = ((1 - edge / b) / (1 + edge)).toFixed(4);
  const ruinProb = Math.min(100, Math.max(0.1, Math.pow(Number(z), riskUnits) * 100));

  return Number(ruinProb.toFixed(1));
}
