import { OHLC, SignalResponse } from '../types';

const formatEntryTime = (unixTime: number): string => {
  const pkTime = new Date((unixTime + 18000) * 1000);
  return pkTime.toISOString().substr(11, 5);
};

const createNeutralResponse = (reason: string): SignalResponse => {
  return {
    signal: 'NEUTRAL',
    confidence: 0,
    reason: reason,
    timestamp: Date.now(),
    entryTime: "---",
    targetCandleTime: 0,
    indicators: {
      structure: "---",
      levelStatus: "---",
      momentum: "---",
      pattern: "Scanning..."
    }
  };
};

export const analyzeMarket = (candles: OHLC[], useMtg: boolean = true): SignalResponse => {
  if (!candles || candles.length < 20) {
    return createNeutralResponse("Gathering Data...");
  }

  const lastCandle = candles[candles.length - 1];
  const lastTime = lastCandle.time;

  const candidates: SignalResponse[] = [];

  for (let i = 1; i <= 3; i++) {
    const targetTime = lastTime + (i * 60);
    const targetMinute = Math.floor((targetTime % 3600) / 60);

    let greenCount = 0;
    let redCount = 0;
    let totalMatches = 0;

    for (let j = 0; j < candles.length - 1; j++) {
      const historicalCandle = candles[j];
      const historicalMinute = Math.floor((historicalCandle.time % 3600) / 60);

      if (historicalMinute === targetMinute) {
        totalMatches++;
        if (historicalCandle.close > historicalCandle.open) {
          greenCount++;
        } else if (historicalCandle.close < historicalCandle.open) {
          redCount++;
        }
      }
    }

    if (totalMatches < 2) continue;

    const greenRate = (greenCount / totalMatches) * 100;
    const redRate = (redCount / totalMatches) * 100;

    let direction: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
    let winRate = 0;

    if (greenRate >= 85) {
      direction = 'CALL';
      winRate = greenRate;
    } else if (redRate >= 85) {
      direction = 'PUT';
      winRate = redRate;
    }

    if (direction !== 'NEUTRAL') {
      const entryTimeFormatted = formatEntryTime(targetTime);

      candidates.push({
        signal: direction,
        confidence: Math.round(winRate),
        reason: `Pure Stats ${targetMinute}'`,
        timestamp: Date.now(),
        entryTime: entryTimeFormatted,
        targetCandleTime: targetTime,
        indicators: {
          structure: `Samples: ${totalMatches}`,
          levelStatus: "Probability Bias",
          momentum: `${Math.round(winRate)}% Win Rate`,
          pattern: `M0+M1 Strategy`
        }
      });
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => a.targetCandleTime - b.targetCandleTime);
    return candidates[0];
  }

  return createNeutralResponse("Scanning...");
};
