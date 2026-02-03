import { OHLC, SignalResponse } from '../types';

/**
 * 📊 PROBABILITY & SEASONALITY ENGINE
 *
 * STRATEGY RULES:
 * 1. Source: Last 500 candles.
 * 2. Logic: Analyzes specific minute performance (Seasonality).
 *    - If predicting for 10:15, look at all past :15 candles.
 * 3. Calculation:
 *    - Count GREEN vs RED occurrences for that minute.
 *    - Win Rate = (Dominant Color / Total) * 100.
 * 4. Filters:
 *    - Win Rate >= 75%.
 *    - M0 >= 85%, M1 75-84%.
 * 5. Timezone: Input data is already shifted to UTC+5. We calculate the next minute based on that.
 */

// Helper to format Unix timestamp to HH:mm
const formatEntryTime = (unixTime: number): string => {
    return new Date(unixTime * 1000).toLocaleTimeString('en-GB', {
        timeZone: 'UTC',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const analyzeMarket = (candles: OHLC[]): SignalResponse => {
    // 1. Validation
    if (!candles || candles.length < 50) {
        return createNeutralResponse("Gathering Data (Need 50+)...");
    }

    const lastCandle = candles[candles.length - 1];
    const lastTime = lastCandle.time;

    let bestSignal: SignalResponse | null = null;
    let highestWinRate = 0;

    // 2. Scan from 2 to 4 minutes ahead (i=2 to 4)
    for (let i = 2; i <= 4; i++) {
        // Calculate future timestamp
        const targetTime = lastTime + (i * 60);

        // Get the minute (0-59) of this future time
        const targetMinute = Math.floor((targetTime % 3600) / 60);

        // 3. Historical Analysis (Seasonality)
        let greenCount = 0;
        let redCount = 0;
        let totalMatches = 0;

        // Iterate backwards through history (excluding the very last forming candle)
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

        // 4. Calculate Probability
        if (totalMatches < 5) continue; // Need at least 5 samples

        const greenRate = (greenCount / totalMatches) * 100;
        const redRate = (redCount / totalMatches) * 100;

        let direction: 'CALL' | 'PUT' | 'NEUTRAL' = 'NEUTRAL';
        let winRate = 0;

        if (greenRate >= 75) {
            direction = 'CALL';
            winRate = greenRate;
        } else if (redRate >= 75) {
            direction = 'PUT';
            winRate = redRate;
        }

        // 5. Select Best Signal
        if (direction !== 'NEUTRAL') {
            if (winRate > highestWinRate) {
                highestWinRate = winRate;

                // Determine Martingale Level
                let strategyType = "M1"; // 75-84%
                if (winRate >= 85) strategyType = "M0 (Direct Win)";

                const entryTimeFormatted = formatEntryTime(targetTime);

                bestSignal = {
                    signal: direction,
                    confidence: Math.round(winRate),
                    reason: `${strategyType} | Entry: ${entryTimeFormatted}`,
                    timestamp: Date.now(),
                    entryTime: entryTimeFormatted,
                    targetCandleTime: targetTime,
                    indicators: {
                        structure: `Sample size: ${totalMatches}`,
                        levelStatus: strategyType,
                        momentum: `${Math.round(winRate)}% Win Rate`,
                        pattern: `Minute :${targetMinute.toString().padStart(2, '0')} Seasonality`
                    }
                };
            }
        }
    }

    // 6. Return Result
    if (bestSignal) {
        return bestSignal;
    }

    return createNeutralResponse("No signals >75% in next 2-4 mins");
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
