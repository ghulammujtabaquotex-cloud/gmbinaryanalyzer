import { useEffect, useRef } from 'react';
import { OHLC } from '../types';
import { analyzeMarket } from '../services/technicalAnalysis';

export const useTradeManager = (
    candles: OHLC[],
    currentCandle: OHLC | null,
    symbol: string,
    onSignalDetected: (type: 'CALL' | 'PUT', entryTime: string) => void
) => {
    // Track the time of the last candle we successfully alerted on to prevent duplicate alerts
    const lastAlertedTime = useRef<number>(0);
    // Global cooldown to enforce wait after a signal
    const cooldownUntil = useRef<number>(0);
    // Track first run to prevent instant alerts on page load
    const isFirstRun = useRef<boolean>(true);

    useEffect(() => {
        // Reset state when symbol changes
        lastAlertedTime.current = 0;
        cooldownUntil.current = 0;
        isFirstRun.current = true;
    }, [symbol]);

    useEffect(() => {
        // Need sufficient data for analysis
        if (candles.length < 20 || !currentCandle) return;

        // SKIP INITIAL LOAD ALERT
        if (isFirstRun.current) {
            lastAlertedTime.current = currentCandle.time;
            isFirstRun.current = false;
            return;
        }

        // Check Global Cooldown
        if (Date.now() < cooldownUntil.current) return;

        const liveTime = currentCandle.time;

        // Prevent re-alerting for the same candle
        if (liveTime === lastAlertedTime.current) return;

        // Perform analysis on every tick
        const allCandles = [...candles, currentCandle];
        const analysis = analyzeMarket(allCandles);

        // SIGNAL THRESHOLD
        if (analysis.confidence >= 60 && analysis.signal !== 'NEUTRAL') {

            // Trigger Notification
            onSignalDetected(analysis.signal as 'CALL' | 'PUT', analysis.entryTime);

            // Mark this candle as alerted
            lastAlertedTime.current = liveTime;

            // Set 3 Minute Cooldown to prevent spam
            cooldownUntil.current = Date.now() + 180000;
        }

    }, [candles, currentCandle, symbol, onSignalDetected]);
};
